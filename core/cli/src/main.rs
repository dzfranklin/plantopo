use std::{env, net::SocketAddr, process::Stdio, str::FromStr};

use eyre::{eyre, Result, WrapErr};
use futures_util::{stream::StreamExt, SinkExt};
use plantopo_common::ClientId;
use serde::{Deserialize, Serialize};
use tokio::{
    io::{AsyncBufReadExt, AsyncWriteExt, BufReader},
    process::Command,
};
use tokio_tungstenite::tungstenite::Message;
use tracing_subscriber::prelude::*;

const DEFAULT_ADDR: &str = "127.0.0.1:4004";

#[tokio::main]
async fn main() -> Result<()> {
    color_eyre::install()?;
    tracing_subscriber::registry()
        .with(tracing_subscriber::EnvFilter::try_from_default_env()?)
        .with(tracing_subscriber::fmt::layer())
        .init();

    let addr = env::var("PLANTOPO_SYNC_SERVER_ADDR").unwrap_or_else(|_| DEFAULT_ADDR.to_string());
    let addr = SocketAddr::from_str(&addr)?;

    let authorizer_secret = env::var("PLANTOPO_SYNC_SERVER_SECRET")
        .wrap_err("PLANTOPO_SYNC_SERVER_SECRET must be set")?;

    let map_id = env::args()
        .nth(1)
        .ok_or_else(|| eyre!("Provide map_id as argument"))?;

    let user_id = "19e0a352-d4fb-11ed-93f1-d3f98d69d7c3";

    // Get a token
    let client = reqwest::Client::new();
    let AuthorizeResp { token, client_id } = client
        .post(format!("http://{addr}/authorize"))
        .header("Authorization", format!("Bearer {}", authorizer_secret))
        .json(&AuthorizeReq {
            user_id: user_id.to_string(),
            map_id: map_id.to_string(),
            write: true,
        })
        .send()
        .await
        .wrap_err("/authorize")?
        .json()
        .await
        .wrap_err("decode /authorize")?;
    let client_id = ClientId(client_id);
    tracing::info!("You are: {client_id:?} ({})", client_id.into_inner());

    let ws_url = format!("ws://{addr}/ws/{map_id}");
    let req = http::Request::builder()
        .method("GET")
        .header("Host", addr.to_string())
        .header("Connection", "Upgrade")
        .header("Upgrade", "websocket")
        .header("Sec-WebSocket-Version", "13")
        .header(
            "Sec-WebSocket-Key",
            tokio_tungstenite::tungstenite::handshake::client::generate_key(),
        )
        .uri(&ws_url)
        .header("Authorization", format!("Bearer {}", token))
        .body(())?;
    let (stream, _) = tokio_tungstenite::connect_async(req).await?;
    let (mut tx, mut rx) = stream.split();
    tracing::info!("Connected to {ws_url}");

    let mut sender = tokio::spawn(async move {
        let mut stdin = BufReader::new(tokio::io::stdin()).lines();
        loop {
            let line = if let Some(line) = stdin.next_line().await? {
                line
            } else {
                break;
            };

            let msg = match message_from_json(&line).await {
                Ok(msg) => msg,
                Err(err) => {
                    tracing::warn!("{err}");
                    continue;
                }
            };

            tracing::info!("Sent {} bytes", msg.len());
            tx.send(Message::Binary(msg)).await?;
        }
        Ok::<_, eyre::Report>(())
    });

    let mut receiver = tokio::spawn(async move {
        while let Some(msg) = rx.next().await {
            match msg? {
                Message::Binary(msg) => {
                    let msg = message_to_json(&msg).await?;
                    println!("< {}", msg);
                }
                Message::Close(_) => {
                    tracing::info!("Server closed connection");
                    break;
                }
                other => {
                    tracing::info!("Unexpected message: {:#?}", other);
                    continue;
                }
            }
        }
        Ok::<_, eyre::Report>(())
    });

    tokio::select! {
        res = &mut sender => {
            receiver.abort();
            res??;
        }
        res = &mut receiver => {
            sender.abort();
            res??;
        }
    }

    Ok(())
}

async fn message_to_json(msg: &[u8]) -> Result<String> {
    let mut cmd = Command::new("pt-sync-inspector")
        .args(&["--type", "sync"])
        .arg("--decode")
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()?;

    {
        let mut stdin = cmd.stdin.take().unwrap();
        stdin.write_all(msg).await?;
        stdin.shutdown().await?;
    }

    let out = cmd.wait_with_output().await?;

    if !out.status.success() {
        let stderr = String::from_utf8_lossy(&out.stderr);
        eprintln!("{}", stderr);
        return Err(eyre!("pt-sync-inspector failed"));
    }

    let json = String::from_utf8(out.stdout)?;
    Ok(json)
}

async fn message_from_json(msg: &str) -> Result<Vec<u8>> {
    let mut cmd = Command::new("pt-sync-inspector")
        .args(&["--type", "sync"])
        .arg("--encode")
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()?;

    {
        let mut stdin = cmd.stdin.take().unwrap();
        stdin.write_all(msg.as_bytes()).await?;
        stdin.shutdown().await?;
    }

    let out = cmd.wait_with_output().await?;

    if !out.status.success() {
        let stderr = String::from_utf8_lossy(&out.stderr);
        eprintln!("{}", stderr);
        return Err(eyre!("pt-sync-inspector failed"));
    }

    let bytes = out.stdout;
    Ok(bytes)
}

#[derive(Debug, Serialize)]
struct AuthorizeReq {
    user_id: String,
    map_id: String,
    write: bool,
}

#[derive(Debug, Deserialize)]
struct AuthorizeResp {
    token: String,
    client_id: u64,
}

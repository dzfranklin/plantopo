use std::{env, net::SocketAddr, str::FromStr};

use eyre::{eyre, Result, WrapErr};
use futures_util::{stream::StreamExt, SinkExt};
use plantopo_sync_core as sync_core;
use serde::{Deserialize, Serialize};
use sync_core::SyncProto;
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio_tungstenite::tungstenite::Message;
use tracing_subscriber::prelude::*;

const DEFAULT_ADDR: &str = "127.0.0.1:4004";

#[tokio::main]
async fn main() -> Result<()> {
    color_eyre::install()?;
    tracing_subscriber::registry()
        .with(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "plantopo_sync_server=info".into()),
        )
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
    let AuthorizeResp { token } = client
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

            let msg = match serde_json::from_str::<SyncProto>(&line) {
                Ok(msg) => msg,
                Err(err) => {
                    let col = err.column() as isize;

                    let before_lower = (col - 30).max(0) as usize;
                    let after_upper = (col + 30).min(line.len() as isize) as usize;

                    let before = &line[before_lower..col as usize];
                    let after = &line[col as usize..after_upper];

                    let snippet = format!(
                        "{}{}{}{}",
                        if before_lower > 0 { ".." } else { "" },
                        before,
                        after,
                        if after_upper < line.len() { ".." } else { "" },
                    );

                    let marker = format!("  {}^", " ".repeat(before.len()));

                    tracing::warn!("{err}\n\t{snippet}\n\t{marker}");

                    continue;
                }
            };

            tracing::info!("Sending {msg:?}");
            let bytes = msg.to_bytes()?;

            tx.send(Message::Binary(bytes)).await?;
        }
        Ok::<_, eyre::Report>(())
    });

    let mut receiver = tokio::spawn(async move {
        while let Some(msg) = rx.next().await {
            match msg? {
                Message::Binary(msg) => {
                    let msg = SyncProto::from_bytes(&msg)?;
                    println!("< {:#?}", msg);
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

#[derive(Debug, Serialize)]
struct AuthorizeReq {
    user_id: String,
    map_id: String,
    write: bool,
}

#[derive(Debug, Deserialize)]
struct AuthorizeResp {
    token: String,
}

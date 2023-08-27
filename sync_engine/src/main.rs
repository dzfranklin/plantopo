#![feature(result_option_inspect)]

use std::{
    fs,
    io::{stdin, stdout, BufRead, BufReader, BufWriter, Write},
    path::PathBuf,
};

use clap::Parser as _;
use eyre::{Context, Result};
use rand::{rngs::SmallRng, SeedableRng};
use serde::{Deserialize, Serialize};
use tracing_subscriber::{prelude::*, EnvFilter};

use pt_sync_engine::{
    store::{self, LocalFileStore, ProdStore, Store},
    Change, Engine, Op,
};

#[derive(Debug, clap::Parser)]
struct Args {
    #[arg(long)]
    map_id: u32,
    #[arg(long)]
    dev: bool,
    #[arg(long)]
    redis_url: Option<String>,
    #[arg(long)]
    snapshot_url: Option<String>,
    #[arg(long)]
    snapshot_token: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(tag = "action", rename_all = "snake_case")]
enum Command {
    Connect { id: u32 },
    Recv { id: u32, value: ClientUpdate },
}

#[derive(Debug, Deserialize)]
struct ClientUpdate {
    ops: Vec<Op>,
    seq: u32,
}

#[derive(Debug, Serialize)]
#[serde(tag = "action", rename_all = "snake_case")]
#[allow(clippy::large_enum_variant)] // The big one, Send, is most likely
enum CommandReply {
    Connect {
        id: u32,
        fid_block_start: u64,
        fid_block_until: u64,
        state: Change,
    },
    Send {
        id: u32,
        recv_seq: Option<u32>,
        reply: Change,
        bcast: Option<Change>,
    },
    SendError {
        id: u32,
        error: String,
        details: String,
    },
}

fn main() -> Result<()> {
    color_eyre::install()?;
    tracing_subscriber::registry()
        .with(tracing_error::ErrorLayer::default())
        .with(
            tracing_subscriber::fmt::layer()
                .pretty()
                .with_writer(std::io::stderr),
        )
        .with(EnvFilter::from_default_env())
        .init();

    let args = Args::parse();
    tracing::info!(?args);

    if args.dev {
        let store_path = PathBuf::from(".sync_store").join(args.map_id.to_string());
        accept(LocalFileStore::open(store_path)?)
    } else {
        let config = store::prod::Config {
            redis_url: args.redis_url.expect("--redis-url required if not --dev"),
            snapshot_url: args
                .snapshot_url
                .expect("--snapshot-url required if not --dev"),
            snapshot_token: args
                .snapshot_token
                .expect("--snapshot-token required if not --dev"),
        };
        accept(ProdStore::open(config, args.map_id)?)
    }
}

fn accept<S>((store, snapshot): (S, Change)) -> Result<()>
where
    S: Store + std::fmt::Debug,
{
    let mut engine = Engine::load(store, SmallRng::from_entropy(), snapshot)?;
    tracing::trace!(?engine);
    tracing::debug!("Loaded engine");

    let mainloop_res = do_mainloop(&mut engine);
    tracing::trace!(?mainloop_res, "mainloop exited");

    let flush_res = engine.store_mut().flush();

    match (mainloop_res, flush_res) {
        (Ok(_), Ok(_)) => Ok(()),
        (Err(mainloop_err), Ok(_)) => Err(mainloop_err),
        (Ok(_), Err(flush_err)) => Err(flush_err),
        (Err(mainloop_err), Err(flush_err)) => {
            tracing::error!(%mainloop_err, %flush_err, "Got flush error after mainloop error");
            Err(mainloop_err)
        }
    }
}

fn do_mainloop<S>(engine: &mut Engine<S>) -> Result<()>
where
    S: Store,
{
    let mut stdout = BufWriter::new(stdout().lock());
    let mut stdin = BufReader::new(stdin().lock());
    let mut line = String::new();

    loop {
        line.clear();
        if stdin.read_line(&mut line)? == 0 {
            break;
        }
        let line = line.trim();

        if line == "exit" {
            tracing::info!("Exiting");
            // Note we inentionally don't save a snapshot here to avoid
            // a thundering herd when shutting down a server and to ensure
            // the startup with wal entries present path is routinely
            // exercised
            break;
        } else if line.is_empty() {
            continue;
        } else if line.starts_with("dbg") {
            if line == "dbg_tree" {
                let dbg = engine.dbg_tree();
                fs::write("dbg_tree.dot", dbg)?;
                eprintln!("Wrote graph to dbg_tree.dot\n");
                continue;
            } else if line.starts_with("dbg_obj") {
                let Some(obj_id) = line.split_whitespace().nth(1) else {
                    eprintln!("Usage: dbg_obj <obj_id>");
                    continue;
                };
                let Ok(obj_id) = serde_json::from_str(obj_id) else {
                    eprintln!("Failed to parse obj_id as u64");
                    continue;
                };
                eprintln!("{}\n", engine.dbg_object(obj_id));
                continue;
            }
        }

        let cmd: Command = serde_json::from_str(line).wrap_err("Invalid cmd")?;
        tracing::trace!(?cmd);

        let reply = match cmd {
            Command::Connect { id } => {
                let fid_block = engine.allocate_fid_block()?;
                let state = engine.to_snapshot();
                CommandReply::Connect {
                    id,
                    fid_block_start: fid_block.start,
                    fid_block_until: fid_block.end,
                    state,
                }
            }
            Command::Recv { id, value } => match engine.apply(value.ops) {
                Ok(change_reply) => CommandReply::Send {
                    id,
                    recv_seq: Some(value.seq),
                    reply: change_reply.reply_only,
                    bcast: Some(change_reply.change),
                },
                Err(report) => {
                    #[cfg(debug_assertions)]
                    eprintln!("Apply error:{:?}\n", report);

                    tracing::info!(apply_error=%report);
                    CommandReply::SendError {
                        id,
                        error: format!("{report}"),
                        details: format!("{report:#}"),
                    }
                }
            },
        };
        tracing::trace!(?reply);

        let reply = serde_json::to_string(&reply)?;
        stdout.write_all(reply.as_bytes())?;
        stdout.write_all(b"\n")?;
        stdout.flush()?;
    }

    Ok(())
}

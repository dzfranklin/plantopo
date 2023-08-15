#![feature(result_option_inspect)]

use std::{
    fs,
    io::{stdin, stdout, BufRead, BufReader, BufWriter, Write},
};

use eyre::{Context, Result};
use serde::{Deserialize, Serialize};
use tracing_subscriber::{prelude::*, EnvFilter};

use plantopo_sync_engine::{
    store::{LocalFileStore, Store},
    Changeset, Engine, Op,
};

#[derive(Debug, Deserialize)]
struct InputContainer {
    client: u16,
    msg: String,
}

#[derive(Debug, Deserialize)]
struct InputMsg {
    ops: Vec<Op>,
    seq: u32,
}

#[derive(Debug, Serialize)]
enum OpResult {
    Ok {
        changeset: Box<Changeset>,
        reply_to: u16,
        seq: u32,
    },
    Err {
        message: String,
        reply_to: Option<u16>,
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

    let mut map_id = String::new();
    stdin()
        .read_line(&mut map_id)
        .wrap_err("read map_id from stdin")?;
    let map_id: u32 = map_id.trim().parse().wrap_err("parse map_id")?;

    let store_fname = format!("engine-map-{map_id}");
    let (store, snapshot) = LocalFileStore::open(&store_fname)?;
    let mut engine = Engine::new(store, snapshot)?;
    tracing::debug!(?store_fname, "Loaded engine");

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
        stdin.read_line(&mut line)?;
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

        let InputContainer {
            msg: input_msg,
            client,
        } = match serde_json::from_str(line).wrap_err("Failed to deserialize input") {
            Ok(input) => input,
            Err(report) => {
                #[cfg(debug_assertions)]
                {
                    eprintln!("\nReceived:\n    {line}");
                    eprintln!("\nError:{:?}\n", report);
                }

                serde_json::to_writer(
                    &mut stdout,
                    &OpResult::Err {
                        reply_to: None,
                        message: format!("{report:#}"),
                    },
                )?;
                stdout.write_all(b"\n")?;
                stdout.flush()?;
                continue;
            }
        };

        let input_msg: InputMsg = match serde_json::from_str(&input_msg) {
            Ok(input_msg) => input_msg,
            Err(report) => {
                #[cfg(debug_assertions)]
                {
                    eprintln!("\nReceived msg:\n    {input_msg}");
                    eprintln!("\nError:{:?}\n", report);
                }

                serde_json::to_writer(
                    &mut stdout,
                    &OpResult::Err {
                        reply_to: None,
                        message: format!("{report:#}"),
                    },
                )?;
                stdout.write_all(b"\n")?;
                stdout.flush()?;
                continue;
            }
        };
        tracing::trace!(?input_msg);

        let cset = match engine.apply(client, input_msg.ops) {
            Ok(cset) => cset,
            Err(report) => {
                #[cfg(debug_assertions)]
                eprintln!("\nError:{:?}\n", report);

                serde_json::to_writer(
                    &mut stdout,
                    &OpResult::Err {
                        reply_to: Some(client),
                        message: format!("{report:#}"),
                    },
                )?;
                stdout.write_all(b"\n")?;
                stdout.flush()?;
                continue;
            }
        };
        tracing::trace!(?cset);

        serde_json::to_writer(
            &mut stdout,
            &OpResult::Ok {
                changeset: Box::new(cset),
                reply_to: client,
                seq: input_msg.seq,
            },
        )?;
        stdout.write_all(b"\n")?;
        stdout.flush()?;
    }

    Ok(())
}

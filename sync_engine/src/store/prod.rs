use std::{
    thread,
    time::{Duration, Instant},
};

use crossbeam::channel;
use rand::{distributions::Uniform, prelude::Distribution, rngs::SmallRng, Rng, SeedableRng};
use redis::{Cmd, Commands};

use crate::{Change, Metadata};

use super::Store;

const CONNECT_TIMEOUT: Duration = Duration::from_secs(15);
const SNAPSHOT_INTERVAL: Duration = Duration::from_secs(60);
const SNAPSHOT_INTERVAL_JITTER_PLUSMINUS: Duration = Duration::from_secs(5);

#[derive(Debug, Clone)]
pub struct Config {
    pub redis_url: String,
    pub snapshot_url: String,
    pub snapshot_token: String,
}

#[derive(Debug)]
pub struct ProdStore {
    queue: channel::Sender<Action>,
    meta: Metadata,
}

enum Action {
    Push(Change),
    SetMeta(Metadata),
    Flush(channel::Sender<()>),
}

#[derive(Debug, serde::Serialize)]
struct SnapshotPostBody<'a> {
    map_id: u32,
    value: SnapshotPostValue<'a>,
}

#[derive(Debug, serde::Serialize)]
struct SnapshotPostValue<'a> {
    meta: &'a Metadata,
    value: &'a Change,
}

impl ProdStore {
    #[tracing::instrument]
    pub fn open(config: Config, map_id: u32) -> eyre::Result<(Self, Change)> {
        let mut conn =
            redis::Client::open(config.redis_url)?.get_connection_with_timeout(CONNECT_TIMEOUT)?;

        let meta: Metadata = conn.get(&meta_key_for(map_id))?;
        let snapshot: Change = conn.lrange(&wal_key_for(map_id), 0, -1)?;

        let (tx, rx) = channel::bounded(20);

        let meta2 = meta.clone();
        let snapshot2 = snapshot.clone();
        thread::spawn(move || {
            worker_thread(
                map_id,
                meta2,
                snapshot2,
                rx,
                conn,
                config.snapshot_url,
                config.snapshot_token,
            )
        });

        Ok((Self { queue: tx, meta }, snapshot))
    }

    fn enqueue(&mut self, action: Action) -> eyre::Result<()> {
        self.queue
            .send(action)
            .map_err(|_| eyre::eyre!("RedisStore worker died prematurely"))
    }
}

impl Store for ProdStore {
    fn meta(&self) -> &Metadata {
        &self.meta
    }

    fn set_meta(&mut self, meta: Metadata) -> eyre::Result<()> {
        self.meta = meta.clone();
        self.enqueue(Action::SetMeta(meta))
    }

    fn push(&mut self, entry: crate::Change) -> eyre::Result<()> {
        self.enqueue(Action::Push(entry))
    }

    fn flush(&mut self) -> eyre::Result<()> {
        let (res_tx, res_rx) = channel::bounded(1);
        self.enqueue(Action::Flush(res_tx))?;
        res_rx
            .recv()
            .map_err(|_| eyre::eyre!("RedisStore worker died prematurely"))?;
        Ok(())
    }
}

fn worker_thread(
    map_id: u32,
    mut meta: Metadata,
    mut snapshot: Change,
    queue: channel::Receiver<Action>,
    mut conn: redis::Connection,
    snapshot_url: String,
    snapshot_token: String,
) {
    use channel::RecvTimeoutError::*;

    let meta_key = meta_key_for(map_id);
    let wal_key = wal_key_for(map_id);

    let mut rng = SmallRng::from_entropy();
    let snapshot_jitter_plusminus =
        Uniform::from(Duration::from_millis(0)..SNAPSHOT_INTERVAL_JITTER_PLUSMINUS);
    let mut next_snapshot_deadline = || {
        let mut deadline = Instant::now() + SNAPSHOT_INTERVAL;
        if rng.gen() {
            deadline += snapshot_jitter_plusminus.sample(&mut rng);
        } else {
            deadline -= snapshot_jitter_plusminus.sample(&mut rng);
        }
        deadline
    };

    let req = reqwest::blocking::Client::new();

    let mut deadline = next_snapshot_deadline();
    loop {
        if deadline < Instant::now() {
            save_snapshot(
                &req,
                &snapshot_url,
                &snapshot_token,
                map_id,
                &meta,
                &snapshot,
            );
            deadline = next_snapshot_deadline();
        }

        let action = match queue.recv_deadline(deadline) {
            Ok(action) => action,
            Err(Timeout) => continue,
            Err(Disconnected) => break,
        };

        match action {
            Action::SetMeta(value) => {
                Cmd::set(&meta_key, &value).query::<()>(&mut conn).unwrap();
                meta = value;
            }
            Action::Push(entry) => {
                Cmd::rpush(&wal_key, &entry).query::<()>(&mut conn).unwrap();
                snapshot += entry;
            }
            Action::Flush(tx) => {
                save_snapshot(
                    &req,
                    &snapshot_url,
                    &snapshot_token,
                    map_id,
                    &meta,
                    &snapshot,
                );
                deadline = next_snapshot_deadline();
                let _ = tx.send(());
            }
        }
    }
}

fn save_snapshot(
    req: &reqwest::blocking::Client,
    snapshot_url: &str,
    snapshot_token: &str,
    map_id: u32,
    meta: &Metadata,
    snapshot: &Change,
) {
    let _ = req
        .post(snapshot_url)
        .bearer_auth(snapshot_token)
        .json(&SnapshotPostBody {
            map_id,
            value: SnapshotPostValue {
                meta,
                value: snapshot,
            },
        })
        .send()
        .unwrap()
        .error_for_status()
        .unwrap();
}

fn meta_key_for(map_id: u32) -> String {
    format!("map:{map_id}:meta")
}

fn wal_key_for(map_id: u32) -> String {
    format!("map:{map_id}:wal")
}
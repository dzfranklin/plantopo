use std::{thread, time::Duration};

use crossbeam::channel;
use redis::{Cmd, Commands};

use crate::{Change, Metadata};

use super::Store;

const CONNECT_TIMEOUT: Duration = Duration::from_secs(15);

//TODO: Save snapshots

#[derive(Debug)]
pub struct RedisStore {
    meta_key: String,
    wal_key: String,
    queue: channel::Sender<Action>,
    meta: Metadata,
}

enum Action {
    Cmd(Cmd),
    Flush(channel::Sender<()>),
}

impl RedisStore {
    #[tracing::instrument]
    pub fn open(map_id: u32, url: &str) -> eyre::Result<(Self, Change)> {
        let mut conn = redis::Client::open(url)?.get_connection_with_timeout(CONNECT_TIMEOUT)?;

        let meta_key = format!("map:{map_id}:meta");
        let wal_key = format!("map:{map_id}:wal");

        let meta: Metadata = conn.get(&meta_key)?;
        let snapshot: Change = conn.lrange(&wal_key, 0, -1)?;

        let (tx, rx) = channel::bounded(20);

        thread::spawn(move || worker_thread(rx, conn));

        Ok((
            Self {
                meta_key,
                wal_key,
                queue: tx,
                meta,
            },
            snapshot,
        ))
    }

    fn enqueue(&mut self, action: Action) -> eyre::Result<()> {
        self.queue
            .send(action)
            .map_err(|_| eyre::eyre!("RedisStore worker died prematurely"))
    }
}

impl Store for RedisStore {
    fn meta(&self) -> &Metadata {
        &self.meta
    }

    fn set_meta(&mut self, meta: Metadata) -> eyre::Result<()> {
        self.meta = meta.clone();
        self.enqueue(Action::Cmd(Cmd::set(&self.meta_key, meta)))
    }

    fn push(&mut self, entry: crate::Change) -> eyre::Result<()> {
        self.enqueue(Action::Cmd(Cmd::rpush(&self.wal_key, entry)))
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

fn worker_thread(queue: channel::Receiver<Action>, mut conn: redis::Connection) {
    loop {
        let Ok(action) = queue.recv() else {
            break;
        };
        match action {
            Action::Cmd(cmd) => cmd.query(&mut conn).unwrap(),
            Action::Flush(tx) => {
                let _ = tx.send(());
            }
        }
    }
}

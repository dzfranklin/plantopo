use std::{
    fs::{self, File},
    io::{BufRead, BufReader, Seek, Write},
    path::PathBuf,
    thread,
    time::Duration,
};

use crossbeam::channel;
use eyre::{eyre, Context};

use super::Store;
use crate::Change;

#[derive(Debug)]
pub struct LocalFileStore {
    #[allow(unused)] // For Debug
    path: PathBuf,
    queue: channel::Sender<Action>,
}

const SNAPSHOT_INTERVAL: Duration = Duration::from_secs(15);

enum Action {
    Push(Change),
    Flush(channel::Sender<eyre::Result<()>>),
}

impl LocalFileStore {
    /// Returns (store, snapshot)
    #[tracing::instrument(skip(path))]
    pub fn open(path: impl Into<PathBuf>) -> eyre::Result<(Self, Change)> {
        let path = path.into();
        let (queue_tx, queue_rx) = channel::unbounded();

        let mut wal_fname = path
            .file_name()
            .ok_or_else(|| eyre!("Invalid path: {}", path.display()))?
            .to_owned();
        wal_fname.push("-wal");
        let wal_path = path.with_file_name(wal_fname);

        let snapshot_f = fs::OpenOptions::new()
            .read(true)
            .write(true)
            .create(true)
            .open(&path)
            .wrap_err_with(|| eyre!("open {}", path.display()))?;

        let wal_f = fs::OpenOptions::new()
            .read(true)
            .append(true)
            .create(true)
            .open(&wal_path)
            .wrap_err_with(|| eyre!("open {}", wal_path.display()))?;

        let mut snapshot_r = BufReader::new(&snapshot_f);
        let mut snapshot = if snapshot_r.has_data_left().wrap_err("read snapshot")? {
            serde_json::from_reader(snapshot_r).wrap_err("parse snapshot")?
        } else {
            tracing::trace!(?path, "no snapshot");
            Change::default()
        };

        for line in BufReader::new(&wal_f).lines() {
            let line = line.wrap_err("failed to read from wal")?;
            let entry: Change = serde_json::from_str(&line)?;
            snapshot += entry;
        }

        let snapshot2 = snapshot.clone();
        thread::spawn(move || worker_thread(snapshot2, queue_rx, snapshot_f, wal_f));

        Ok((
            Self {
                path,
                queue: queue_tx,
            },
            snapshot,
        ))
    }
}

impl Store for LocalFileStore {
    #[tracing::instrument]
    fn push(&mut self, entry: Change) -> eyre::Result<()> {
        self.queue
            .send(Action::Push(entry))
            .wrap_err("worker died prematurely")
    }

    #[tracing::instrument]
    fn flush(&mut self) -> eyre::Result<()> {
        let (res_tx, res_rx) = channel::bounded(1);
        self.queue
            .send(Action::Flush(res_tx))
            .wrap_err("worker died prematurely")?;
        res_rx.recv().wrap_err("worker died prematurely")?
    }
}

/// Panics on error. Since this is run on the worker thread that kills the
/// worker, and the next queue send will error.
fn worker_thread(
    snapshot: Change,
    queue: channel::Receiver<Action>,
    mut snapshot_f: File,
    mut wal_f: File,
) {
    let mut working_snapshot = snapshot;

    loop {
        channel::select! {
            recv(queue) -> action => {
                let Ok(action) = action else {
                    break;
                };

                match action {
                    Action::Push(entry) => {
                        do_push(entry, &mut wal_f, &mut working_snapshot).unwrap();
                    }
                    Action::Flush(res_tx) => {
                        let res = do_flush(&mut snapshot_f, &mut wal_f);
                        let _ = res_tx.send(res);
                    }
                }
            }
            recv(channel::after(SNAPSHOT_INTERVAL)) -> _ => {
                do_snapshot(&mut snapshot_f, &mut wal_f, &working_snapshot).unwrap();
            }
        }
    }

    tracing::debug!("Worker thread complete");
}

fn do_push(entry: Change, wal_f: &mut File, working_snapshot: &mut Change) -> eyre::Result<()> {
    let mut line = serde_json::to_vec(&entry)?;
    line.push(b'\n');

    wal_f.write_all(&line)?;
    wal_f.flush()?;
    wal_f.sync_data()?;

    *working_snapshot += entry;

    Ok(())
}

fn do_snapshot(
    snapshot_f: &mut File,
    wal_f: &mut File,
    working_snapshot: &Change,
) -> eyre::Result<()> {
    let mut value = serde_json::to_vec(&working_snapshot)?;
    value.push(b'\n');

    snapshot_f.set_len(0)?;
    snapshot_f.rewind()?;
    snapshot_f.write_all(&value)?;
    snapshot_f.flush()?;
    snapshot_f.sync_data()?;

    wal_f.set_len(0)?;
    wal_f.rewind()?;
    wal_f.flush()?;
    wal_f.sync_data()?;

    Ok(())
}

fn do_flush(snapshot_f: &mut File, wal_f: &mut File) -> eyre::Result<()> {
    snapshot_f.flush()?;
    snapshot_f.sync_data()?;

    wal_f.flush()?;
    wal_f.sync_data()?;

    Ok(())
}

use std::{
    fs::{self, File},
    io::{BufRead, BufReader, Read, Seek, Write},
    path::PathBuf,
    thread,
    time::Duration,
};

use crossbeam::channel;
use eyre::{eyre, Context};

use super::Store;
use crate::{Change, Metadata};

#[derive(Debug)]
pub struct LocalFileStore {
    #[allow(unused)] // For Debug
    path: PathBuf,
    queue: channel::Sender<Action>,
    meta: Metadata,
}

const SNAPSHOT_INTERVAL: Duration = Duration::from_secs(15);

enum Action {
    Push(Change),
    SetMeta(Metadata),
    Flush(channel::Sender<eyre::Result<()>>),
}

impl LocalFileStore {
    /// Returns (store, snapshot)
    #[tracing::instrument(skip(path))]
    pub fn open(path: impl Into<PathBuf>) -> eyre::Result<(Self, Change)> {
        let path = path.into();
        let (queue_tx, queue_rx) = channel::unbounded();

        let base_fname = path
            .file_name()
            .ok_or_else(|| eyre!("Invalid path: {}", path.display()))?
            .to_owned();
        let base_fname = base_fname
            .to_str()
            .ok_or_else(|| eyre!("Invalid path: {}", path.display()))?;

        let wal_fname = format!("{base_fname}-wal.jsonl");
        let wal_path = path.with_file_name(wal_fname);

        let meta_fname = format!("{base_fname}-meta.json");
        let meta_path = path.with_file_name(meta_fname);

        if let Some(parent_dir) = path.parent() {
            fs::create_dir_all(parent_dir)?;
        }

        let mut meta_f = fs::OpenOptions::new()
            .read(true)
            .write(true)
            .create(true)
            .open(&meta_path)
            .wrap_err_with(|| eyre!("open {}", meta_path.display()))?;

        let mut snapshot_f = fs::OpenOptions::new()
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

        let mut meta = String::new();
        meta_f
            .read_to_string(&mut meta)
            .wrap_err("read meta file")?;
        let meta = if meta.is_empty() {
            Metadata::default()
        } else {
            serde_json::from_str(&meta).wrap_err_with(|| eyre!("parse meta file"))?
        };

        let mut snapshot = String::new();
        snapshot_f
            .read_to_string(&mut snapshot)
            .wrap_err("read snapshot file")?;
        let mut snapshot = if snapshot.is_empty() {
            Change::default()
        } else {
            serde_json::from_str(&snapshot).wrap_err("parse snapshot file")?
        };

        for line in BufReader::new(&wal_f).lines() {
            let line = line.wrap_err("failed to read from wal")?;
            let entry: Change = serde_json::from_str(&line)?;
            snapshot += entry;
        }

        let snapshot2 = snapshot.clone();
        thread::spawn(move || worker_thread(snapshot2, queue_rx, meta_f, snapshot_f, wal_f));

        Ok((
            Self {
                path,
                queue: queue_tx,
                meta,
            },
            snapshot,
        ))
    }
}

impl Store for LocalFileStore {
    fn meta(&self) -> &Metadata {
        &self.meta
    }

    #[tracing::instrument]
    fn set_meta(&mut self, meta: Metadata) -> eyre::Result<()> {
        self.queue
            .send(Action::SetMeta(meta.clone()))
            .wrap_err("worker died prematurely")?;
        self.meta = meta;
        Ok(())
    }

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
    mut meta_f: File,
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
                    Action::SetMeta(meta) => {
                        do_set_meta(meta, &mut meta_f).unwrap();
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

fn do_set_meta(meta: Metadata, meta_f: &mut File) -> eyre::Result<()> {
    let value = serde_json::to_vec(&meta)?;

    meta_f.set_len(0)?;
    meta_f.rewind()?;
    meta_f.write_all(&value)?;
    meta_f.flush()?;
    meta_f.sync_data()?;

    Ok(())
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

mod local_file;

pub use self::local_file::LocalFileStore;

use serde::{Deserialize, Serialize};

use crate::{Change, Metadata};

pub trait Store {
    fn meta(&self) -> &Metadata;
    fn set_meta(&mut self, meta: Metadata) -> eyre::Result<()>;
    fn push(&mut self, entry: Change) -> eyre::Result<()>;
    fn flush(&mut self) -> eyre::Result<()>;
}

#[derive(Debug, Default)]
pub struct NullStore(pub Metadata);

impl Store for NullStore {
    fn meta(&self) -> &Metadata {
        &self.0
    }

    fn set_meta(&mut self, _meta: Metadata) -> eyre::Result<()> {
        Ok(())
    }

    fn push(&mut self, _entry: Change) -> eyre::Result<()> {
        Ok(())
    }

    fn flush(&mut self) -> eyre::Result<()> {
        Ok(())
    }
}

#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
pub struct InMemoryStore {
    pub meta: Metadata,
    pub wal: Vec<Change>,
}

impl Store for InMemoryStore {
    fn meta(&self) -> &Metadata {
        &self.meta
    }

    fn set_meta(&mut self, meta: Metadata) -> eyre::Result<()> {
        self.meta = meta;
        Ok(())
    }

    fn push(&mut self, change: Change) -> eyre::Result<()> {
        self.wal.push(change);
        Ok(())
    }

    fn flush(&mut self) -> eyre::Result<()> {
        Ok(())
    }
}

impl InMemoryStore {
    pub fn to_snapshot(&self) -> Change {
        let mut value = Change::default();
        for entry in &self.wal {
            value += entry.clone();
        }
        value
    }
}

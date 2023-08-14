mod local_file;

pub use self::local_file::LocalFileStore;

use serde::{Deserialize, Serialize};

use crate::Change;

pub trait Store {
    fn push(&mut self, entry: Change) -> eyre::Result<()>;

    fn flush(&mut self) -> eyre::Result<()>;
}

#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
pub struct InMemoryStore(Vec<Change>);

impl Store for InMemoryStore {
    fn push(&mut self, change: Change) -> eyre::Result<()> {
        self.0.push(change);
        Ok(())
    }

    fn flush(&mut self) -> eyre::Result<()> {
        Ok(())
    }
}

impl InMemoryStore {
    pub fn wal(&self) -> &[Change] {
        &self.0
    }
}

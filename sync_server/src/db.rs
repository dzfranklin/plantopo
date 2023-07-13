use std::path::Path;

use eyre::{eyre, Result};
use uuid::Uuid;

use plantopo_schema::prelude::*;

pub struct Db {
    db: rocksdb::DB,
}

impl Db {
    pub fn open(path: impl AsRef<Path>) -> Result<Self> {
        let mut opts = rocksdb::Options::default();
        opts.set_compression_type(rocksdb::DBCompressionType::Lz4);
        opts.create_if_missing(true);
        opts.create_missing_column_families(true);
        opts.set_merge_operator_associative("merge_operator", merge_operator);

        let db: rocksdb::DB = rocksdb::DB::open(&opts, path)?;

        Ok(Self { db })
    }

    pub fn merge(&self, id: Uuid, map: &[u8]) -> Result<()> {
        let key = map_key(id);
        self.db.merge(key, map)?;
        Ok(())
    }
}

const MAP_KEY_PREFIX: u8 = 0x10;

fn map_key(id: Uuid) -> [u8; 129] {
    let mut key = [0u8; 129];
    key[0] = MAP_KEY_PREFIX;
    key[1..].copy_from_slice(&id.as_bytes()[..]);
    key
}

fn merge_operator(
    key: &[u8],
    existing: Option<&[u8]>,
    operands: &rocksdb::MergeOperands,
) -> Option<Vec<u8>> {
    todo!()
}

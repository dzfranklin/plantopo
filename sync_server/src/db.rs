use crate::{configure_doc, prelude::*, read_data_json};
use rocksdb::{MergeOperands, OptimisticTransactionDB};
use yrs::{
    updates::{decoder::Decode, encoder::Encode},
    ArrayPrelim, Doc, Map, MapPrelim, ReadTxn, StateVector, Transact, Update,
};

#[derive(Debug, Clone)]
pub struct Db(Arc<OptimisticTransactionDB>);

impl Db {
    #[instrument(skip(path))]
    pub fn open(path: impl AsRef<Path>) -> eyre::Result<Self> {
        let mut db_opts = rocksdb::Options::default();
        db_opts.create_if_missing(true);
        db_opts.set_merge_operator_associative("sync_server_merge", merge);
        let db = OptimisticTransactionDB::open(&db_opts, path)?;
        info!("Opened {:?}", &db);
        Ok(Self(Arc::new(db)))
    }

    #[instrument]
    pub fn get_data(&self, id: Uuid) -> eyre::Result<Option<Doc>> {
        let key = id_to_data_key(id);
        let value = match self.0.get(key)? {
            Some(value) => value,
            None => return Ok(None),
        };
        let value = Update::decode_v1(&value)?;
        let doc = configure_doc();
        {
            let mut tx = doc.transact_mut();
            tx.apply_update(value);
            trace!("data={}", read_data_json(&tx));
        }
        Ok(Some(doc))
    }

    #[instrument]
    pub fn create(&self, id: Uuid, layer_source: u32) -> Result<(), CreateError> {
        let key = id_to_data_key(id);

        let update = {
            let doc = configure_doc();
            let data = doc.get_or_insert_map("data");
            let mut tx = doc.transact_mut();
            data.insert(&mut tx, "features", MapPrelim::<Doc>::new());
            let layer = MapPrelim::from([("sourceId", layer_source)]);
            data.insert(&mut tx, "layers", ArrayPrelim::from([layer]));
            debug!("data={}", read_data_json(&tx));
            tx.encode_state_as_update_v1(&StateVector::default())
        };

        let tx = self.0.transaction();
        let existing = tx
            .get_for_update(key, true)
            .map_err(CreateError::internal)?;
        if existing.is_some() {
            info!("failed to create map as id already exists");
            return Err(CreateError::AlreadyExists);
        } else {
            tx.put(key, update).map_err(CreateError::internal)?;
            info!("inserted newly created map {}", id);
        }
        tx.commit().map_err(CreateError::internal)?;

        Ok(())
    }

    #[instrument(skip(update))]
    pub fn update_data(&self, id: Uuid, update: impl AsRef<[u8]>) -> eyre::Result<()> {
        let key = id_to_data_key(id);
        self.0.merge(key, update)?;
        Ok(())
    }
}

#[derive(thiserror::Error, Debug)]
pub enum CreateError {
    #[error("already exists")]
    AlreadyExists,
    #[error(transparent)]
    Internal(eyre::Error),
}

impl CreateError {
    fn internal(err: impl Into<eyre::Error>) -> Self {
        Self::Internal(err.into())
    }
}

fn merge(key: &[u8], current: Option<&[u8]>, ops: &MergeOperands) -> Option<Vec<u8>> {
    let ty = key[0];
    let id = match key[1..].try_into() {
        Ok(id) => Uuid::from_bytes(id),
        Err(_) => {
            error!(
                "merge: key in incorrect format (len={}): {:x?}",
                key.len(),
                key
            );
            return None;
        }
    };

    let _span = trace_span!(
        "merge_yupdate",
        ty = ty,
        id = %id,
        current_is_some = current.is_some(),
        ops_len = ops.len()
    )
    .entered();

    let result = match ty {
        TYPE_DATA => merge_data(current, ops),
        _ => Err(eyre!("Unrecognized key type: {}", ty)),
    };

    match result {
        Ok(out) => Some(out),
        Err(err) => {
            error!("merge failed: {err}");
            None
        }
    }
}

fn merge_data(current: Option<&[u8]>, ops: &MergeOperands) -> eyre::Result<Vec<u8>> {
    let current = current.map_or(Ok(Update::default()), Update::decode_v1);
    let ops = ops.into_iter().map(Update::decode_v1);
    let all = iter::once(current)
        .chain(ops)
        .collect::<Result<Vec<_>, lib0::error::Error>>()
        .wrap_err("decode ops")?;
    let combined = Update::merge_updates(all);
    Ok(combined.encode_v1())
}

// fn merge_data(current: Option<&[u8]>, ops: &MergeOperands) -> eyre::Result<Vec<u8>> {
//     let doc = configure_doc();
//     let mut tx = doc.transact_mut();

//     if let Some(current) = current {
//         let current = Update::decode_v1(current)?;
//         tx.apply_update(current);
//         trace!(current_data=%read_data_json(&tx));
//     } else {
//         trace!("current is None");
//     }

//     for op in ops {
//         let op = Update::decode_v1(op)?;
//         tx.apply_update(op);
//     }
//     trace!(ops_len=?ops.len(), merged_data=%read_data_json(&tx));

//     let merged = tx.encode_state_as_update_v1(&StateVector::default());
//     Ok(merged)
// }

const UUID_LEN: usize = 16;
const KEY_LEN: usize = UUID_LEN + 1;
const TYPE_DATA: u8 = 1;

fn id_to_data_key(id: Uuid) -> [u8; KEY_LEN] {
    let mut data_key = [0u8; KEY_LEN];
    data_key[0] = TYPE_DATA;
    data_key[1..KEY_LEN].copy_from_slice(id.as_bytes());
    data_key
}

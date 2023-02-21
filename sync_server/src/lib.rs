#[allow(unused)]
use eyre::{eyre, Context};
#[allow(unused)]
use tracing::{debug, error, info, instrument, trace, warn};

use rocksdb::{MergeOperands, OptimisticTransactionDB};
use serde::Deserialize;
use std::{
    collections::HashMap,
    fmt,
    path::Path,
    sync::{Arc, Weak},
};
use uuid::Uuid;
use weak_table::WeakValueHashMap;
use y_sync::awareness::Awareness;
use yrs::{
    types::ToJson,
    updates::{
        decoder::Decode,
        encoder::{Encoder, EncoderV2},
    },
    Array, ArrayPrelim, Doc, Map, MapPrelim, ReadTxn, StateVector, Transact, TransactionMut,
    Update, UpdateEvent,
};
use yrs_warp::{broadcast::BroadcastGroup, AwarenessRef};

const BCAST_SIZE: usize = 32;

pub type ActivesRef = Arc<tokio::sync::Mutex<WeakValueHashMap<Uuid, Weak<ActiveMap>>>>;
pub type DbRef = Arc<OptimisticTransactionDB>;

pub struct ActiveMap {
    pub id: Uuid,
    pub awareness: AwarenessRef,
    pub bcast: BroadcastGroup,
    _sub: yrs::UpdateSubscription,
}

impl fmt::Debug for ActiveMap {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.debug_struct("MapState")
            .field("id", &self.id)
            .finish_non_exhaustive()
    }
}

#[instrument(skip(path))]
pub fn open_db(path: impl AsRef<Path>) -> eyre::Result<DbRef> {
    let mut db_opts = rocksdb::Options::default();
    db_opts.create_if_missing(true);
    db_opts.set_merge_operator_associative("ymerge", ymerge);
    let db = OptimisticTransactionDB::open(&db_opts, path)?;
    info!("Opened {:?}", &db);
    Ok(Arc::new(db))
}

#[instrument(skip(db))]
pub fn get_snapshot(db: DbRef, id: Uuid) -> eyre::Result<Option<String>> {
    let doc = match load_doc(db, id)? {
        Some(doc) => doc,
        None => return Ok(None),
    };
    let mut out = String::new();
    doc.to_json(&doc.transact()).to_json(&mut out);
    Ok(Some(out))
}

#[derive(Deserialize, Debug)]
pub struct CreateReq {
    layers: String,
    features: String,
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

#[instrument(skip(db))]
pub fn create(db: DbRef, id: Uuid, req: CreateReq) -> Result<(), CreateError> {
    use lib0::any::Any;

    // TODO: Auth

    let layers_value = Any::from_json(&req.layers).map_err(CreateError::internal)?;
    let features_value = Any::from_json(&req.features).map_err(CreateError::internal)?;

    let doc = configure_doc();

    let layers = doc.get_or_insert_array("layers");
    let features = doc.get_or_insert_map("features");
    {
        let mut tx = doc.transact_mut();
        initialize_deep(&mut tx, Parent::Array(layers), layers_value);
        initialize_deep(&mut tx, Parent::Map(features), features_value);
        info!("creating: {}: {}", id, doc.to_json(&tx));
    }

    let mut encoder = EncoderV2::new();
    doc.transact()
        .encode_diff(&StateVector::default(), &mut encoder);
    let update = encoder.to_vec();
    trace!("update={:?}", Update::decode_v2(&update));

    {
        let tx = db.transaction();
        let existing = tx.get_for_update(id, true).map_err(CreateError::internal)?;
        if existing.is_some() {
            return Err(CreateError::AlreadyExists);
        } else {
            tx.put(id, update).map_err(CreateError::internal)?;
        }
        tx.commit().map_err(CreateError::internal)?;
    }

    Ok(())
}

#[instrument(skip_all)]
fn ymerge(
    _new_key: &[u8],
    existing_val: Option<&[u8]>,
    operands: &MergeOperands,
) -> Option<Vec<u8>> {
    // NOTE: Update::merge_updates doesn't work, but based on code comments that might a
    // bug/missing feature. There might be a more efficent way to do this

    let existing_val =
        existing_val.map(|v| Update::decode_v2(v).expect("ymerge failed to decode existing_val"));

    let doc = existing_val
        .map(apply_full_update)
        .unwrap_or_else(configure_doc);

    let mut tx = doc.transact_mut();

    trace!("ymerge before: {}", doc.to_json(&tx));
    for update in operands.iter() {
        let update = Update::decode_v2(update).expect("operand contains invalid update");
        tx.apply_update(update);
    }
    trace!("ymerge after {} ops: {}", operands.len(), doc.to_json(&tx));

    let mut encoder = EncoderV2::new();
    tx.encode_diff(&StateVector::default(), &mut encoder);
    let value = encoder.to_vec();

    Some(value)
}

#[instrument(skip(db, maps))]
pub async fn get_active(
    db: DbRef,
    maps: ActivesRef,
    id: Uuid,
) -> eyre::Result<Option<Arc<ActiveMap>>> {
    let mut lock = maps.lock().await;
    if let Some(map) = lock.get(&id) {
        info!("Got map from active");
        Ok(Some(map))
    } else if let Some(map) = load_map(db, id).await? {
        info!("Loaded map from db to active");
        let map = Arc::new(map);
        lock.insert(id, map.clone());
        Ok(Some(map))
    } else {
        info!("Map not found");
        Ok(None)
    }
}

#[instrument(skip(db))]
fn load_doc(db: DbRef, id: Uuid) -> eyre::Result<Option<Doc>> {
    if let Some(update) = db.get(id)? {
        let update = Update::decode_v2(&update).context("failed to decode stored state")?;
        let doc = apply_full_update(update);
        debug!("loaded doc {}", doc.to_json(&doc.transact()));
        Ok(Some(doc))
    } else {
        Ok(None)
    }
}

fn apply_full_update(value: Update) -> Doc {
    let doc = configure_doc();
    doc.transact_mut().apply_update(value);
    doc
}

fn configure_doc() -> yrs::Doc {
    let opts = yrs::Options {
        skip_gc: true,
        ..Default::default()
    };
    let doc = Doc::with_options(opts);
    doc.get_or_insert_array("layers");
    doc.get_or_insert_map("features");
    doc
}

#[instrument(skip(db))]
async fn load_map(db: DbRef, id: Uuid) -> eyre::Result<Option<ActiveMap>> {
    let doc = match load_doc(db.clone(), id)? {
        Some(doc) => doc,
        None => return Ok(None),
    };

    debug!("Loaded {}", doc.to_json(&doc.transact()));

    let sub = doc
        .observe_update_v2(move |tx, update| on_update(db.clone(), id, tx, update))
        .expect("Failed to subscribe to doc");

    let awareness = Arc::new(tokio::sync::RwLock::new(Awareness::new(doc)));
    let bcast = BroadcastGroup::open(awareness.clone(), BCAST_SIZE).await;

    Ok(Some(ActiveMap {
        id,
        awareness,
        bcast,
        _sub: sub,
    }))
}

fn on_update(db: DbRef, id: Uuid, _tx: &TransactionMut, update: &UpdateEvent) {
    debug!("update {}: {:?}", id, Update::decode_v2(&update.update));

    db.merge(id, &update.update)
        .expect("failed to write to db in on_update");
}

type AnyMap = Box<HashMap<String, lib0::any::Any>>;
type AnyArray = Box<[lib0::any::Any]>;

enum Parent {
    Map(yrs::MapRef),
    Array(yrs::ArrayRef),
}

#[allow(clippy::boxed_local)]
fn initialize_deep(tx: &mut TransactionMut, parent: Parent, value: lib0::any::Any) {
    use lib0::any::Any;

    match parent {
        Parent::Map(parent) => {
            let value = any_as_hashmap(value).unwrap();
            for (child_key, child_value) in value.into_iter() {
                if matches!(child_value, Any::Map(_) | Any::Array(_)) {
                    let child_parent = match child_value {
                        Any::Map(_) => {
                            Parent::Map(parent.insert(tx, child_key, MapPrelim::<Doc>::new()))
                        }
                        Any::Array(_) => {
                            Parent::Array(parent.insert(tx, child_key, ArrayPrelim::default()))
                        }
                        _ => unreachable!(),
                    };
                    initialize_deep(tx, child_parent, child_value);
                } else {
                    parent.insert(tx, child_key, child_value);
                }
            }
        }
        Parent::Array(parent) => {
            let value = any_as_array(value).unwrap();
            for child_value in value.iter() {
                let child_value = child_value.clone();
                if matches!(child_value, Any::Map(_) | Any::Array(_)) {
                    let child_parent = match child_value {
                        Any::Map(_) => Parent::Map(parent.push_back(tx, MapPrelim::<Doc>::new())),
                        Any::Array(_) => {
                            Parent::Array(parent.push_back(tx, ArrayPrelim::default()))
                        }
                        _ => unreachable!(),
                    };
                    initialize_deep(tx, child_parent, child_value);
                } else {
                    parent.push_back(tx, child_value);
                }
            }
        }
    }
}

fn any_as_hashmap(value: lib0::any::Any) -> eyre::Result<AnyMap> {
    match value {
        lib0::any::Any::Map(value) => Ok(value),
        _ => Err(eyre!("not a map")),
    }
}

fn any_as_array(value: lib0::any::Any) -> eyre::Result<AnyArray> {
    match value {
        lib0::any::Any::Array(value) => Ok(value),
        _ => Err(eyre!("not a map")),
    }
}

#[cfg(test)]
mod test {
    use super::*;
    use assert_json_diff::assert_json_eq;
    use serde_json::json;
    use tempfile::{tempdir, TempDir};

    struct TestState {
        _db_dir: TempDir,
        _trace: tracing::subscriber::DefaultGuard,
        db: DbRef,
    }

    impl TestState {
        fn new() -> Self {
            color_eyre::install().unwrap();
            let subscriber = tracing_subscriber::fmt()
                .pretty()
                .with_env_filter(tracing_subscriber::EnvFilter::from_default_env())
                .with_test_writer()
                .finish();
            let trace = tracing::subscriber::set_default(subscriber);

            let db_dir = tempdir().unwrap();
            let db = open_db(db_dir.path()).unwrap();
            Self {
                _db_dir: db_dir,
                _trace: trace,
                db,
            }
        }
    }

    #[test]
    fn create_then_snapshot() -> eyre::Result<()> {
        let state = TestState::new();
        let db = state.db;

        let id = Uuid::new_v4();

        create(
            db.clone(),
            id,
            CreateReq {
                layers: json!([
                    {
                        "sourceId": 42,
                        "opacity": 1
                    },
                    {
                        "sourceId": 1,
                        "opacity": 0.34
                    }
                ])
                .to_string(),
                features: json!({
                  "1aac3792-3ecc-4399-8a52-36c3d61271f1": {
                    "properties": {
                      "nested": "works"
                    }
                  }
                })
                .to_string(),
            },
        )?;

        let actual = get_snapshot(db, id)?.expect("exists");
        let actual: serde_json::Value = serde_json::from_str(&actual)?;

        assert_json_eq!(
            json!({
                  "layers": [
                      {
                          "sourceId": 42,
                          "opacity": 1
                      },
                      {
                          "sourceId": 1,
                          "opacity": 0.34
                      }
                  ],
                  "features": {
                    "1aac3792-3ecc-4399-8a52-36c3d61271f1": {
                      "properties": {
                        "nested": "works"
                      }
                    }
                  }
            }),
            actual
        );

        Ok(())
    }
}

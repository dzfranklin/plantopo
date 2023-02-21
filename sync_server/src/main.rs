#[allow(unused)]
use eyre::{eyre, Context};
use rocksdb::{MergeOperands, DB};
use serde::Deserialize;
use std::{
    convert::Infallible,
    env, fmt, iter,
    sync::{Arc, Weak},
};
use tokio::select;
#[allow(unused)]
use tracing::{debug, error, info, instrument, trace, warn};
use uuid::Uuid;
use warp::{
    body::BodyDeserializeError,
    hyper::StatusCode,
    reject, reply,
    ws::{WebSocket, Ws},
    Filter, Reply,
};
use weak_table::WeakValueHashMap;
use y_sync::awareness::Awareness;
use yrs::{
    types::ToJson,
    updates::{decoder::Decode, encoder::Encode},
    Doc, Map, Transact, TransactionMut, Update, UpdateEvent,
};
use yrs_warp::{broadcast::BroadcastGroup, ws::WarpConn, AwarenessRef};

const BCAST_SIZE: usize = 32;

type ActivesRef = Arc<tokio::sync::Mutex<WeakValueHashMap<Uuid, Weak<ActiveMap>>>>;

struct ActiveMap {
    id: Uuid,
    awareness: AwarenessRef,
    bcast: BroadcastGroup,
    _sub: yrs::UpdateSubscription,
}

impl fmt::Debug for ActiveMap {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.debug_struct("MapState")
            .field("id", &self.id)
            .finish_non_exhaustive()
    }
}

#[derive(Debug)]
struct InternalError(eyre::Error);
impl warp::reject::Reject for InternalError {}

#[tokio::main]
async fn main() -> eyre::Result<()> {
    color_eyre::install().unwrap();
    let subscriber = tracing_subscriber::fmt()
        .pretty()
        .with_env_filter(tracing_subscriber::EnvFilter::from_default_env())
        .finish();
    tracing::subscriber::set_global_default(subscriber).unwrap();

    let mut db_opts = rocksdb::Options::default();
    db_opts.create_if_missing(true);
    db_opts.set_merge_operator_associative("ymerge", ymerge);
    let db_path = env::var("PLANTOPO_SYNC_DB").context("PLANTOPO_SYNC_DB")?;
    let db = DB::open(&db_opts, db_path)?;
    info!("Opened {:?}", &db);
    let db = Arc::new(db);

    let actives: ActivesRef = Arc::new(Default::default());

    let and_db = warp::any().map(move || db.clone());
    let and_actives = warp::any().map(move || actives.clone());

    let ws_path = warp::path("socket")
        .and(warp::path::param::<Uuid>())
        .and(warp::path::end())
        .and(warp::ws())
        .and(and_db.clone())
        .and(and_actives)
        .and_then(|id, ws: Ws, db, actives| async move {
            // TODO: Auth

            if let Some(map) = get_active(db, actives, id).await.map_err(InternalError)? {
                Ok(ws
                    .on_upgrade(move |socket| map_peer(socket, map))
                    .into_response())
            } else {
                Err(reject::not_found())
            }
        });

    let create_path = warp::path("create")
        .and(warp::path::end())
        .and(warp::post())
        .and(warp::body::json())
        .and(and_db.clone())
        .and_then(|body: CreateReq, db| async move {
            create(db, body).map_err(InternalError)?;
            Ok::<_, warp::Rejection>(warp::reply())
        });

    let paths = ws_path
        .or(create_path)
        .or(warp::any().and_then(|| async { Err::<Infallible, _>(reject::not_found()) }))
        .recover(handle_rejection);

    warp::serve(paths).run(([0, 0, 0, 0], 4005)).await;

    Ok(())
}

async fn handle_rejection(err: warp::Rejection) -> Result<impl Reply, Infallible> {
    trace!("handle_rejection: {:?}", err);

    if err.is_not_found() {
        Ok(reply::with_status("Not Found", StatusCode::NOT_FOUND))
    } else if let Some(err) = err.find::<InternalError>() {
        info!("InternalError: {}", err.0);
        Ok(reply::with_status(
            "Internal Server Error\n",
            StatusCode::INTERNAL_SERVER_ERROR,
        ))
    } else if err.find::<reject::MethodNotAllowed>().is_some() {
        Ok(reply::with_status(
            "Method Not Allowed\n",
            StatusCode::METHOD_NOT_ALLOWED,
        ))
    } else if err.find::<reject::UnsupportedMediaType>().is_some() {
        Ok(reply::with_status(
            "Unsupported Media Type\n",
            StatusCode::UNSUPPORTED_MEDIA_TYPE,
        ))
    } else if let Some(err) = err.find::<BodyDeserializeError>() {
        debug!("{}", err);
        Ok(reply::with_status("Bad Request\n", StatusCode::BAD_REQUEST))
    } else {
        info!("Unhandled rejection: {:?}", err);
        Ok(reply::with_status(
            "Internal Server Error\n",
            StatusCode::INTERNAL_SERVER_ERROR,
        ))
    }
}

#[derive(Deserialize, Debug)]
struct CreateReq {
    id: Uuid,
    value: String,
}

fn create(db: Arc<DB>, req: CreateReq) -> eyre::Result<()> {
    // TODO: Auth
    db.put(req.id, Update::default().encode_v2())?;
    Ok(())
}

fn ymerge(
    _new_key: &[u8],
    existing_val: Option<&[u8]>,
    operands: &MergeOperands,
) -> Option<Vec<u8>> {
    let existing_val = existing_val
        .map(|v| Update::decode_v2(v).expect("ymerge failed to decode existing_val"))
        .unwrap_or_default();

    let operands = operands
        .into_iter()
        .map(|op| Update::decode_v2(op).expect("ymerge failed to decode operand"));

    let new_val = Update::merge_updates(iter::once(existing_val).chain(operands));

    Some(new_val.encode_v2())
}

#[instrument]
async fn map_peer(socket: WebSocket, map: Arc<ActiveMap>) {
    let conn = WarpConn::new(map.awareness.clone(), socket);
    let sub = map.bcast.join(conn.inbox().clone());

    select! {
        _res = sub => {
            // Broadcast finish or broadcast abrupt disconnect
        }
        _res = conn => {
            // Peer disconnect or peer error
        }
    }
}

#[instrument(skip(db, maps))]
async fn get_active(
    db: Arc<DB>,
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
async fn load_map(db: Arc<DB>, id: Uuid) -> eyre::Result<Option<ActiveMap>> {
    let doc = Doc::new();

    if let Some(update) = db.get(id)? {
        let mut tx = doc.transact_mut();
        let update = Update::decode_v2(&update).context("failed to decode stored state")?;
        tx.apply_update(update);
    } else {
        return Ok(None);
    }

    if tracing::event_enabled!(tracing::Level::DEBUG) {
        let dump = doc.to_json(&doc.transact());
        debug!("Loaded: {}", dump);
    }

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

type AnyMap = Box<HashMap<String, lib0::any::Any>>;
type AnyArray = Box<[lib0::any::Any]>;
fn on_update(db: Arc<DB>, id: Uuid, _tx: &TransactionMut, update: &UpdateEvent) {
    debug!("update {}: {:?}", id, Update::decode_v2(&update.update));

enum Parent {
    Map(MapRef),
    Array(ArrayRef),
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

fn get_ymap_json(tx: &impl ReadTxn, name: &str) -> Option<String> {
    let map_ref = tx.get_map(name)?;
    let mut out = String::new();
    map_ref.to_json(tx).to_json(&mut out);
    Some(out)
    db.merge(id, &update.update)
        .expect("failed to write to db in on_update");
}

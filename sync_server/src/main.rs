use core::fmt;
#[allow(unused)]
use eyre::{eyre, Context};
use std::collections::HashMap;
use std::sync::{Arc, Weak};
use tokio::select;
#[allow(unused)]
use tracing::{debug, error, info, instrument, warn};
use warp::ws::{WebSocket, Ws};
use warp::{reject, Filter, Reply};
use weak_table::WeakValueHashMap;
use y_sync::awareness::Awareness;
use yrs::types::ToJson;
use yrs::{
    Array, ArrayPrelim, ArrayRef, Doc, Map, MapPrelim, MapRef, ReadTxn, Transact, TransactionMut,
};
use yrs_warp::broadcast::BroadcastGroup;
use yrs_warp::ws::WarpConn;
use yrs_warp::AwarenessRef;

const BCAST_SIZE: usize = 32;

type MapsStateRef = Arc<parking_lot::RwLock<WeakValueHashMap<u32, Weak<MapState>>>>;

// TODO: Do we have a consistency issue if we evict and then load right after?
// Could the db update come after the db load?

struct MapState {
    id: u32,
    awareness: AwarenessRef,
    bcast: BroadcastGroup,
    _sub: yrs::UpdateSubscription,
}

impl fmt::Debug for MapState {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.debug_struct("MapState")
            .field("id", &self.id)
            .finish_non_exhaustive()
    }
}

#[tokio::main]
async fn main() {
    color_eyre::install().unwrap();
    let subscriber = tracing_subscriber::fmt()
        .pretty()
        .with_env_filter(tracing_subscriber::EnvFilter::from_default_env())
        .finish();
    tracing::subscriber::set_global_default(subscriber).unwrap();

    let maps: MapsStateRef = Arc::new(parking_lot::RwLock::new(WeakValueHashMap::new()));

    let map_path = warp::path("map")
        .and(warp::any().map(move || maps.clone()))
        .and(warp::path::param::<u32>())
        .and(warp::ws())
        .and_then(|maps, map_id, ws: Ws| async move {
            // May as well crash the connection if this fails
            let map = get_map(maps, map_id).await.expect("get_map failed");

            if let Some(map) = map {
                Ok(ws
                    .on_upgrade(move |socket| map_peer(socket, map))
                    .into_response())
            } else {
                Err(reject::not_found())
            }
        });

    warp::serve(map_path).run(([0, 0, 0, 0], 4005)).await;
}

#[instrument]
async fn map_peer(socket: WebSocket, map: Arc<MapState>) {
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

#[instrument(skip(maps))]
async fn get_map(maps: MapsStateRef, map_id: u32) -> eyre::Result<Option<Arc<MapState>>> {
    if let Some(map) = maps.read().get(&map_id) {
        info!("Got map from memory");
        return Ok(Some(map));
    }

    let new_map = match load_map(map_id).await? {
        Some(new_map) => Arc::new(new_map),
        None => {
            info!("Load map failed, nonexistent");
            return Ok(None);
        }
    };

    let mut lock = maps.write();
    if let Some(existing) = lock.get(&map_id) {
        info!("While map loaded someone else populated memory, so got map from memory");
        Ok(Some(existing))
    } else {
        info!("Got map from load");
        lock.insert(map_id, new_map.clone());
        Ok(Some(new_map))
    }
}

#[instrument]
async fn load_map(id: u32) -> eyre::Result<Option<MapState>> {
    // TODO: Request from phoenix
    let doc = Doc::new();

    let initial = r#"{
        "view": {
            "layers": [{"opacity":1,"sourceId":1},{"sourceId":2,"opacity":0.2}]
        },
        "features": {
            "708ec5d9-b403-4a8d-b204-84a0c01cf90b": {
                "id": "708ec5d9-b403-4a8d-b204-84a0c01cf90b",
                "parent": "root"
            }
        }
    }"#;

    // TODO: Store state vectors in a kv store (sled? whats backup like)

    let mut initial = lib0::any::Any::from_json(initial)
        .context("parse initial json")
        .and_then(any_as_hashmap)?;

    let initial_view = initial
        .remove("view")
        .ok_or_else(|| eyre!("initial view missing"))?;

    let initial_features = initial
        .remove("features")
        .ok_or_else(|| eyre!("initial features missing"))?;

    {
        let view = doc.get_or_insert_map("view");
        let features = doc.get_or_insert_map("features");

        let mut tx = doc.transact_mut();
        initialize_deep(&mut tx, Parent::Map(view), initial_view);
        initialize_deep(&mut tx, Parent::Map(features), initial_features);
    }

    let sub = doc
        .observe_update_v1(move |tx, _update| {
            let view = get_ymap_json(tx, "view").expect("update has view");
            let features = get_ymap_json(tx, "features").expect("update has features");

            debug!(
                "map update: id={}\nview={}\nfeatures={}",
                id, view, features
            );
        })
        .expect("Failed to subscribe to doc");

    let awareness = Arc::new(tokio::sync::RwLock::new(Awareness::new(doc)));
    let bcast = BroadcastGroup::open(awareness.clone(), BCAST_SIZE).await;

    Ok(Some(MapState {
        id,
        awareness,
        bcast,
        _sub: sub,
    }))
}

type AnyMap = Box<HashMap<String, lib0::any::Any>>;
type AnyArray = Box<[lib0::any::Any]>;

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
}

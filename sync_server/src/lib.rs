pub mod db;
pub mod manager;
pub mod prelude;

use crate::prelude::*;
use db::{CreateError, Db};
use manager::Manager;
use warp::{
    reject, reply,
    ws::{WebSocket, Ws},
    Reply,
};
use weak_table::WeakValueHashMap;
use y_sync::awareness::Awareness;
use yrs::{types::ToJson, Doc, ReadTxn, Transact};
use yrs_warp::{ws::WarpConn, AwarenessRef};

pub type ActivesRef = Arc<tokio::sync::Mutex<WeakValueHashMap<Uuid, Weak<Active>>>>;

pub struct Active {
    id: Uuid,
    aware: AwarenessRef,
    manager: Manager,
}

impl fmt::Debug for Active {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.debug_struct("Active")
            .field("id", &self.id)
            .finish_non_exhaustive()
    }
}

#[derive(Debug)]
pub struct InternalError(pub eyre::Error);
impl warp::reject::Reject for InternalError {}

#[instrument(skip(db, actives, socket))]
pub async fn handle_socket(
    db: Db,
    actives: ActivesRef,
    id: Uuid,
    socket: Ws,
    addr: SocketAddr,
) -> Result<reply::Response, warp::Rejection> {
    trace!("handle_socket {:?} to {}", addr, id);

    // TODO: Auth
    let active = get_active(db.clone(), actives.clone(), id)
        .await
        .map_err(InternalError)?;

    if let Some(active) = active {
        let reply = socket.on_upgrade(move |socket| async move {
            let result =
                handle_upgraded_socket(db.clone(), actives.clone(), id, active, socket, addr).await;
            if let Err(err) = result {
                warn!("Error in handle_upgraded_socket: {}", err);
            }
        });
        Ok(reply.into_response())
    } else {
        info!("handle_socket: map not found: {}", id);
        Err(reject::not_found())
    }
}

#[instrument(skip_all)]
pub async fn handle_upgraded_socket(
    _db: Db,
    _actives: ActivesRef,
    id: Uuid,
    active: Arc<Active>,
    socket: WebSocket,
    addr: SocketAddr,
) -> eyre::Result<()> {
    trace!("handle_upgraded_socket {:?} to {}", addr, id);
    let conn = WarpConn::new(active.aware.clone(), socket);
    let sub = active.manager.join(conn.inbox().clone());
    info!("connected {addr} to {id}");
    select! {
        _res = sub => {}
        _res = conn => {}
    }
    info!("{addr} disconnected from {id}");
    Ok(())
}

#[instrument(skip(db))]
pub fn get_snapshot(db: Db, id: Uuid) -> eyre::Result<Option<String>> {
    let doc = match db.get_data(id)? {
        Some(doc) => doc,
        None => return Ok(None),
    };
    let mut out = String::new();
    read_data_json(&doc.transact()).to_json(&mut out);
    Ok(Some(out))
}

#[derive(Deserialize, Debug)]
pub struct CreateReq {
    layer_source: u32,
}

#[instrument(skip(db))]
pub fn create(db: Db, id: Uuid, req: CreateReq) -> Result<(), CreateError> {
    // TODO: Auth
    db.create(id, req.layer_source)
}

#[instrument(skip(db, maps))]
pub async fn get_active(db: Db, maps: ActivesRef, id: Uuid) -> eyre::Result<Option<Arc<Active>>> {
    let mut lock = maps.lock().await;
    if let Some(map) = lock.get(&id) {
        info!("Got map from active");
        Ok(Some(map))
    } else if let Some(map) = make_active(db, id).await? {
        info!("Loaded map from db to active");
        let map = Arc::new(map);
        lock.insert(id, map.clone());
        Ok(Some(map))
    } else {
        info!("Map not found");
        Ok(None)
    }
}

fn configure_doc() -> yrs::Doc {
    let opts = yrs::Options {
        skip_gc: false,
        ..Default::default()
    };
    let doc = Doc::with_options(opts);
    doc.get_or_insert_map("data");
    doc
}

#[instrument(skip(db))]
async fn make_active(db: Db, id: Uuid) -> eyre::Result<Option<Active>> {
    let doc = match db.get_data(id)? {
        Some(doc) => doc,
        None => return Ok(None),
    };

    let mut aware = Awareness::new(doc);
    let manager = Manager::new(db, id, &mut aware)?;
    let aware = Arc::new(tokio::sync::RwLock::new(aware));

    Ok(Some(Active { id, aware, manager }))
}

fn read_data_json(tx: &impl ReadTxn) -> lib0::any::Any {
    tx.get_map("data")
        .map(|s| s.to_json(tx))
        .unwrap_or(lib0::any::Any::Undefined)
}

#[cfg(test)]
mod test {
    use std::sync::Once;

    use super::*;
    use assert_json_diff::assert_json_eq;
    use serde_json::json;
    use tempfile::{tempdir, TempDir};
    use yrs::{ArrayPrelim, Map, MapPrelim};

    struct TestState {
        _db_dir: TempDir,
        db: Db,
    }

    impl TestState {
        fn new() -> Self {
            let db_dir = tempdir().unwrap();
            let db = Db::open(db_dir.path()).unwrap();
            Self {
                _db_dir: db_dir,
                db,
            }
        }
    }

    fn setup() -> TestState {
        static ONCE: Once = Once::new();
        ONCE.call_once(|| {
            color_eyre::install().unwrap();
            let subscriber = tracing_subscriber::fmt()
                .pretty()
                .with_env_filter(tracing_subscriber::EnvFilter::from_default_env())
                .with_test_writer()
                .finish();
            tracing::subscriber::set_global_default(subscriber).unwrap();
        });
        TestState::new()
    }

    #[test]
    fn create_then_snapshot() -> eyre::Result<()> {
        let state = setup();
        let db = state.db;

        let id = Uuid::new_v4();

        create(db.clone(), id, CreateReq { layer_source: 42 })?;

        let actual = get_snapshot(db, id)?.expect("exists");
        let actual: serde_json::Value = serde_json::from_str(&actual)?;

        assert_json_eq!(
            json!({
                "features": {},
                "layers": [{"sourceId": 42}]
            }),
            actual
        );

        Ok(())
    }

    #[test]
    fn merge_one_update() -> eyre::Result<()> {
        let state = setup();
        let db = state.db;
        let id = Uuid::new_v4();

        {
            let doc = configure_doc();
            let data = doc.get_or_insert_map("data");

            let current = {
                let mut tx = doc.transact_mut();
                data.insert(
                    &mut tx,
                    "layers",
                    ArrayPrelim::from([MapPrelim::from([("sourceId", 42)])]),
                );
                tx.encode_update_v1()
            };

            let update = {
                let mut tx = doc.transact_mut();
                data.insert(&mut tx, "foobar", 101);
                tx.encode_update_v1()
            };

            db.update_data(id, current)?;
            db.update_data(id, update)?;
        };

        let doc = db.get_data(id)?.unwrap();
        let mut actual = String::new();
        read_data_json(&doc.transact()).to_json(&mut actual);
        let actual: serde_json::Value = serde_json::from_str(&actual)?;

        assert_json_eq!(
            json!({
                "foobar": 101,
                "layers": [{"sourceId": 42}]
            }),
            actual
        );

        Ok(())
    }

    // TODO: Figure out a failing test for the previous buggy merge operator
}

use plantopo_sync_server::{
    create,
    db::{CreateError, Db},
    get_snapshot, handle_socket,
    prelude::*,
    ActivesRef, CreateReq, InternalError,
};
use std::{convert::Infallible, env, net::SocketAddr, sync::Arc};
use uuid::Uuid;
use warp::{
    addr, body::BodyDeserializeError, hyper::StatusCode, path, path::FullPath, reject, reply,
    Filter, Reply,
};

#[tokio::main]
async fn main() -> eyre::Result<()> {
    color_eyre::install().unwrap();
    let subscriber = tracing_subscriber::fmt()
        .pretty()
        .with_env_filter(tracing_subscriber::EnvFilter::from_default_env())
        .finish();
    tracing::subscriber::set_global_default(subscriber).unwrap();

    let db_path = env::var("PLANTOPO_SYNC_DB").wrap_err("PLANTOPO_SYNC_DB")?;
    let db = Db::open(&db_path)?;
    let actives: ActivesRef = Arc::new(Default::default());

    let and_db = warp::any().map(move || db.clone());
    let and_actives = warp::any().map(move || actives.clone());

    let ws_route = path!("map" / Uuid / "socket")
        .and(addr::remote())
        .and(warp::ws())
        .and(and_db.clone())
        .and(and_actives.clone())
        .and_then(
            |id, addr: Option<SocketAddr>, socket, db, actives| async move {
                let addr = addr.expect("transport uses addresses");
                handle_socket(db, actives, id, socket, addr).await
            },
        );

    let create_route = path!("map" / Uuid / "create")
        .and(warp::post())
        .and(warp::body::json())
        .and(and_db.clone())
        .and_then(|id, body: CreateReq, db| async move {
            match create(db, id, body) {
                Ok(()) => Ok(warp::reply::with_status("Created\n", StatusCode::CREATED)),
                Err(CreateError::AlreadyExists) => Ok(warp::reply::with_status(
                    "Already exists\n",
                    StatusCode::CONFLICT,
                )),
                Err(CreateError::Internal(err)) => Err(reject::custom(InternalError(err))),
            }
        });

    let snapshot_route = path!("map" / Uuid / "snapshot")
        .and(and_db.clone())
        .and_then(|id: Uuid, db| async move {
            match get_snapshot(db, id).map_err(InternalError)? {
                Some(json) => Ok(json),
                None => Err(reject::not_found()),
            }
        });

    let paths = ws_route
        .or(create_route)
        .or(snapshot_route)
        .or(path::full().and_then(|path: FullPath| async move {
            info!("Not found: {}", path.as_str());
            Err::<Infallible, _>(reject::not_found())
        }))
        .recover(handle_rejection);

    warp::serve(paths).run(([0, 0, 0, 0], 4005)).await;

    Ok(())
}

async fn handle_rejection(err: warp::Rejection) -> Result<impl Reply, Infallible> {
    trace!("handle_rejection: {:?}", err);

    if err.is_not_found() {
        Ok(reply::with_status("Not Found\n", StatusCode::NOT_FOUND))
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

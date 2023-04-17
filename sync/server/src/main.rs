#![feature(never_type)]

use std::{
    collections::{HashMap, HashSet},
    env,
    net::SocketAddr,
    str::FromStr,
    sync::Arc,
    time::Duration,
};

use axum::{
    extract::{
        ws::{self, WebSocket, WebSocketUpgrade},
        ConnectInfo, Path, State,
    },
    headers::{authorization::Bearer, Authorization},
    http::StatusCode,
    response::IntoResponse,
    routing::{get, post},
    Json, Router, TypedHeader,
};
use bytes::Bytes;
use capnp::{
    message::{ReaderOptions, TypedBuilder},
    serialize_packed,
};
use chrono::Utc;
use core::{convert::TryFrom, fmt};
use eyre::{eyre, Result, WrapErr};
use futures::{sink::SinkExt, stream::StreamExt};
use parking_lot::Mutex;
use pasetors::{
    claims::{Claims, ClaimsValidationRules},
    keys::{Generate, SymmetricKey},
    local,
    token::UntrustedToken,
    version4::V4,
    Local,
};
use plantopo_sync_core as sync_core;
use rand::SeedableRng;
use rand_chacha::ChaCha20Rng;
use serde::{Deserialize, Serialize};
use sqlx::{
    postgres::{PgConnectOptions, PgPoolOptions},
    ConnectOptions,
};
use sync_core::{save_capnp, sync_capnp::message, Client, ClientId, MapId};
use tokio::{
    signal,
    sync::{broadcast, oneshot},
    task::JoinHandle,
    time::sleep,
};
use tower_http::catch_panic::CatchPanicLayer;
use tracing::{instrument, log::LevelFilter};
use tracing_subscriber::prelude::*;
use uuid::Uuid;

use plantopo_sync_server::shutdown;

const SAVE_INTERVAL: Duration = Duration::from_secs(10);
const DEFAULT_ADDR: &str = "127.0.0.1:4004";

struct AppState {
    id: ClientId,
    maps: MapStates,
    token_secret: TokenSecret,
    server_secret: String,
    db: Pool,
    shutdown: shutdown::Observer,
}

impl fmt::Debug for AppState {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.debug_struct("AppState")
            .field("id", &self.id)
            .field("db", &self.db)
            .finish_non_exhaustive()
    }
}

#[derive(Debug)]
struct MapState {
    id: MapId,
    client: Mutex<Client>,
    connected: Mutex<HashSet<ClientId>>,
    broadcast: broadcast::Sender<(ClientId, Bytes)>,
    disconnect: broadcast::Sender<Disconnect>,
}

type MapStates = Mutex<HashMap<MapId, Arc<MapState>>>;
type TokenSecret = SymmetricKey<V4>;
type Pool = sqlx::Pool<sqlx::Postgres>;

#[derive(Deserialize, Serialize, Clone, Copy, Eq, PartialEq, Hash)]
struct UserId(Uuid);

impl fmt::Debug for UserId {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "UserId({})", self.0)
    }
}

#[derive(Debug, Clone)]
enum Disconnect {
    All,
    User(UserId),
}

#[tokio::main]
async fn main() -> Result<()> {
    dotenvy::dotenv()?;
    color_eyre::install()?;
    tracing_subscriber::registry()
        .with(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "plantopo_sync_server=info,plantopo_sync_core=info".into()),
        )
        .with(tracing_subscriber::fmt::layer())
        .init();

    let addr = env::var("PLANTOPO_SYNC_SERVER_ADDR").unwrap_or_else(|_| DEFAULT_ADDR.to_string());
    let addr = SocketAddr::from_str(&addr)?;

    let token_secret = SymmetricKey::<V4>::generate()?;
    let server_secret = env::var("PLANTOPO_SYNC_SERVER_SECRET")
        .wrap_err("PLANTOPO_SYNC_SERVER_SECRET must be set")?;

    let mut db_opts: PgConnectOptions = env::var("DATABASE_URL")?.parse()?;
    db_opts.log_statements(LevelFilter::Debug);
    db_opts.log_slow_statements(LevelFilter::Debug, Duration::from_millis(100));
    let db: Pool = PgPoolOptions::new()
        .max_connections(20)
        .connect_with(db_opts)
        .await?;

    let (shutdown_observer, shutdown_controller) = shutdown::new();

    let app_state = Arc::new(AppState {
        id: ClientId(0x01),
        maps: Mutex::default(),
        token_secret,
        server_secret,
        shutdown: shutdown_observer,
        db,
    });
    assert!(app_state.id.0 > 0, "reserved");

    let router = Router::new()
        .route("/debug", get(get_debug))
        .route("/debug/:id", get(get_debug_map))
        .route("/authorize", post(post_authorize))
        .route("/disconnect", post(post_disconnect))
        .route("/ws/:id", get(ws_handler))
        .layer(CatchPanicLayer::new())
        .with_state(app_state.clone());

    tracing::info!("Listening on {}", addr);

    axum::Server::bind(&addr)
        .serve(router.into_make_service_with_connect_info::<SocketAddr>())
        .with_graceful_shutdown(async move {
            let _ = signal::ctrl_c().await;
            tracing::info!("Received SIGINT, starting shutdown");
            app_state.maps.lock().clear();
        })
        .await?;

    tracing::info!("Waiting for shutdown to complete");
    shutdown_controller.shutdown().await;
    tracing::info!("Shutdown complete");

    Ok(())
}

async fn get_debug(
    TypedHeader(token): TypedHeader<Authorization<Bearer>>,
    State(state): State<Arc<AppState>>,
) -> impl IntoResponse {
    if token.token() != state.server_secret {
        return Err(StatusCode::UNAUTHORIZED);
    }
    Ok(format!("{:#?}\n", state))
}

async fn get_debug_map(
    TypedHeader(token): TypedHeader<Authorization<Bearer>>,
    Path(map_id): Path<Uuid>,
    State(state): State<Arc<AppState>>,
) -> impl IntoResponse {
    if token.token() != state.server_secret {
        return Err(StatusCode::UNAUTHORIZED);
    }
    let map_id = MapId(map_id);
    let maps = state.maps.lock();
    let map_state = maps.get(&map_id);
    Ok(format!("{:#?}\n", map_state))
}

#[derive(Debug, Deserialize)]
struct PostAuthorizeReq {
    user_id: Uuid,
    map_id: Uuid,
    client_id: Option<u64>,
    write: bool,
}

#[derive(Debug, Serialize)]
struct PostAuthorizeResp {
    token: String,
    client_id: u64,
    exp: String,
}

#[instrument(skip(authorizer_token, state))]
async fn post_authorize(
    TypedHeader(authorizer_token): TypedHeader<Authorization<Bearer>>,
    ConnectInfo(addr): ConnectInfo<SocketAddr>,
    State(state): State<Arc<AppState>>,
    Json(payload): Json<PostAuthorizeReq>,
) -> impl IntoResponse {
    if authorizer_token.token() != state.server_secret {
        tracing::info!("Authorizer token mismatch)");
        return Err(StatusCode::UNAUTHORIZED);
    }

    // TODO: Check if the map exists?

    let iat = Utc::now();
    let exp = (iat + chrono::Duration::minutes(10)).to_rfc3339();
    let user_id = payload.user_id.to_string();
    let map_id = MapId(payload.map_id);
    let client_id = if let Some(client_id) = payload.client_id {
        ClientId(client_id)
    } else {
        next_client_id(&state, map_id).await.map_err(|err| {
            tracing::error!("Failed to get next client id: {err})");
            StatusCode::INTERNAL_SERVER_ERROR
        })?
    };

    let mut claims = Claims::new().unwrap();
    claims.subject(&map_id.into_inner().to_string()).unwrap();
    claims.issued_at(&iat.to_rfc3339()).unwrap();
    claims.expiration(&exp).unwrap();
    claims.add_additional("user_id", user_id).unwrap();
    claims.add_additional("client_id", client_id.0).unwrap();
    claims.add_additional("write", payload.write).unwrap();

    let token = local::encrypt(&state.token_secret, &claims, None, None).unwrap();

    tracing::info!("Issued token {claims:?})");

    Ok(Json(PostAuthorizeResp {
        token,
        client_id: client_id.into_inner(),
        exp,
    }))
}

#[derive(Debug, Deserialize)]
struct PostDisconnectReq {
    map_id: Uuid,
    user_id: Option<UserId>,
}

#[instrument(skip(authorizer_token, state))]
async fn post_disconnect(
    TypedHeader(authorizer_token): TypedHeader<Authorization<Bearer>>,
    ConnectInfo(addr): ConnectInfo<SocketAddr>,
    State(state): State<Arc<AppState>>,
    Json(payload): Json<PostDisconnectReq>,
) -> impl IntoResponse {
    if authorizer_token.token() != state.server_secret {
        tracing::info!("Authorizer token mismatch)");
        return StatusCode::UNAUTHORIZED;
    }

    let map_id = MapId(payload.map_id);

    let map_state = match state.maps.lock().get(&map_id).cloned() {
        Some(map_state) => map_state,
        None => {
            tracing::info!("No need to disconnect as map not in state: {map_id:?}");
            return StatusCode::OK;
        }
    };

    let disconnect = if let Some(user_id) = payload.user_id {
        Disconnect::User(user_id)
    } else {
        Disconnect::All
    };

    tracing::info!("Sending disconnect from {map_id:?}: {disconnect:?}");
    let _ = map_state.disconnect.send(disconnect);

    StatusCode::OK
}

#[instrument(skip(token, ws, state))]
async fn ws_handler(
    Path(map_id): Path<Uuid>,
    TypedHeader(token): TypedHeader<Authorization<Bearer>>,
    ConnectInfo(addr): ConnectInfo<SocketAddr>,
    ws: WebSocketUpgrade,
    State(state): State<Arc<AppState>>,
) -> impl IntoResponse {
    let map_id = MapId(map_id);
    let (user_id, client_id, permit_write) = check_token(&state.token_secret, map_id, token)
        .map_err(|err| {
            tracing::info!("Invalid token: {err}");
            StatusCode::UNAUTHORIZED
        })?;

    Ok::<_, StatusCode>(ws.on_upgrade(move |socket| {
        upgraded_ws_handler(
            socket,
            state,
            addr,
            map_id,
            user_id,
            client_id,
            permit_write,
        )
    }))
}

fn check_token(
    secret: &TokenSecret,
    map_id: MapId,
    token: Authorization<Bearer>,
) -> Result<(UserId, ClientId, bool)> {
    let token = UntrustedToken::<Local, V4>::try_from(token.token())?;
    let token = local::decrypt(secret, &token, &ClaimsValidationRules::new(), None, None)?;
    let claims = token
        .payload_claims()
        .ok_or_else(|| eyre!("missing claims"))?;
    let permit_write = claims
        .get_claim("write")
        .and_then(|v| v.as_bool())
        .ok_or_else(|| eyre!("Invalid write claim: {claims:?}"))?;
    let claim_map_id = claims
        .get_claim("sub")
        .and_then(|v| v.as_str())
        .ok_or_else(|| eyre!("Invlaid sub claim: {claims:?}"))?;
    let claim_map_id = Uuid::parse_str(claim_map_id)
        .map(MapId)
        .wrap_err("failed to parse sub claim as uuid")?;
    let user_id = claims
        .get_claim("user_id")
        .and_then(|v| v.as_str())
        .ok_or_else(|| eyre!("Invalid user_id claim: {claims:?}"))?;
    let user_id = Uuid::parse_str(user_id)
        .map(UserId)
        .map_err(|_| eyre::eyre!("failed to parse user_id claim as uuid: {claims:?}"))?;
    let client_id = claims
        .get_claim("client_id")
        .and_then(|v| v.as_u64())
        .map(|v| ClientId(v))
        .ok_or_else(|| eyre!("Invalid client_id claim: {claims:?}"))?;

    if claim_map_id != map_id {
        return Err(eyre!(
            "Sub claim mismatch: claimed {claim_map_id:?} != requested {map_id:?}"
        ));
    }

    Ok((user_id, client_id, permit_write))
}

#[instrument(skip(socket, state))]
async fn upgraded_ws_handler(
    socket: WebSocket,
    state: Arc<AppState>,
    addr: SocketAddr,
    map_id: MapId,
    user_id: UserId,
    peer_id: ClientId,
    permit_write: bool,
) {
    let map_state = match get_map_state(state.clone(), map_id).await {
        Ok(map_state) => map_state,
        Err(e) => {
            tracing::error!("Failed to get map state for {map_id:?}: {e}");
            return;
        }
    };

    map_state.connected.lock().insert(peer_id);

    let broadcast_tx = map_state.broadcast.clone();
    let mut broadcast_rx = broadcast_tx.subscribe();
    let (mut socket_tx, mut socket_rx) = socket.split();
    let mut rx_disconnect = map_state.disconnect.subscribe();

    let recv_task_map_state = map_state.clone();
    let mut recv_task: JoinHandle<eyre::Result<()>> = tokio::spawn(async move {
        let map_state = recv_task_map_state;
        while let Some(msg) = socket_rx.next().await {
            let msg = msg?;
            let req_bytes = match msg {
                ws::Message::Binary(msg) => Bytes::from(msg),
                ws::Message::Text(_) => {
                    return Err(eyre!("unexpected text message"));
                }
                _ => continue,
            };
            let req = serialize_packed::read_message(&*req_bytes, ReaderOptions::default())?;
            let req: message::Reader = req.get_root()?;

            match req.which()? {
                message::Which::Error(err) => {
                    let err = err?;
                    let code = err.get_code();
                    let description = err.get_description()?;

                    tracing::info!("Received error from client: {code:?} {description:?}");
                    return Ok(()); // No need to report an error to the client
                }

                message::Which::Delta(delta) => {
                    let delta = delta?;

                    if !permit_write {
                        return Err(eyre!("write not permitted"));
                    }

                    let _ = broadcast_tx.send((peer_id, req_bytes));

                    let mut client = map_state.client.lock();
                    client.merge(delta)?;
                }
            }
        }

        Ok(())
    });

    let (tx_recv_task_done, mut rx_recv_task_done) = oneshot::channel::<Result<(), &'static str>>();

    let reply_task_map_state = map_state.clone();
    let mut reply_task = tokio::spawn(async move {
        let map_state = reply_task_map_state;

        // Send current state
        let mut b = TypedBuilder::<message::Owned>::new_default();
        {
            let mut b = b.init_root().init_delta();
            map_state.client.lock().write_state(b.reborrow());
        }
        let mut resp_bytes = Vec::new();
        // TODO: Proper error handling here. Not worth it when we're refactoring to worker anyway
        serialize_packed::write_message(&mut resp_bytes, b.borrow_inner()).unwrap();
        let _ = socket_tx.send(ws::Message::Binary(resp_bytes)).await;

        loop {
            tokio::select! {
                // When the recv task exits close, possibly with an error
                recv_res = &mut rx_recv_task_done => {
                    if let Ok(Err(msg)) = recv_res {
                        tracing::info!("Sending error: {msg}");

                        let mut b = TypedBuilder::<message::Owned>::new_default();
                        {
                            // TODO: More specific error messages
                            let mut b = b.init_root().init_error();
                            b.set_code(1);
                            b.set_description("Server error");
                        }

                        let mut resp_bytes = Vec::new();
                        serialize_packed::write_message(&mut resp_bytes, b.borrow_inner()).unwrap();

                        let _ = socket_tx.send(ws::Message::Binary(resp_bytes)).await;
                    }
                    let _ = socket_tx.send(ws::Message::Close(None)).await;
                    break;
                }

                // If we didn't broadcast this message, send it
                res = broadcast_rx.recv() => {
                    match res {
                        Ok((sender, msg)) => {
                            if sender == peer_id {
                                continue;
                            } else {
                                let _ = socket_tx.send(ws::Message::Binary(msg.to_vec())).await;
                            }
                        }
                        Err(broadcast::error::RecvError::Closed) => continue,
                        Err(broadcast::error::RecvError::Lagged(n)) => {
                            tracing::error!("Lagged {n} messages, killing connection");
                            break;
                        },
                    }
                }
            }
        }
    });

    tracing::info!("Connected");

    tokio::select! {
        // If the receiver task finishes end the send task, possibly with an error message
        join_res = &mut recv_task => {
            let res = join_res.unwrap_or(Ok(())); // Treat a join error as a normal exit

            if let Err(report) = res {
                tracing::info!("Receive task exited with error: {report}");
                let _ = tx_recv_task_done.send(Err("internal server error"));
            } else {
                let _ = tx_recv_task_done.send(Ok(()));
            }

            let _ = reply_task.await;
        }
        // If the send task finishes end the receive task
        _ = &mut reply_task => recv_task.abort(),
        // If the server should start shutting down
        _ = state.shutdown.recv() => {
            let _ = tx_recv_task_done.send(Err("server shutting down"));
            let _ = reply_task.await;
            recv_task.abort();
        }
        // If we're told to disconnect end send and receive
        Ok(disconnect) = rx_disconnect.recv() => {
            let matches = match disconnect {
                Disconnect::All => true,
                Disconnect::User(other) => user_id == other,
            };
            if matches {
                tracing::info!("Receive matching disconnect: {disconnect:?}");
                let _ = tx_recv_task_done.send(Err("forcible disconnect"));
                let _ = reply_task.await;
                recv_task.abort();
            }
        }
    };

    tracing::info!("Disconnected");

    if state.shutdown.in_progress() {
        // If we disconnected because a shutdown is in progress we don't want to
        // unnecessarily contend
    } else {
        let is_empty = {
            let mut connected = map_state.connected.lock();
            connected.remove(&peer_id);
            connected.is_empty()
        };

        if is_empty {
            let mut maps = state.maps.lock();

            // If connected is contended then either:
            // - Someone is locking to add, so not empty
            // - Someone is locking to remove: We've already removed outselves,
            //   so they'll handle empty

            let still_empty = map_state
                .connected
                .try_lock()
                .map_or(false, |connected| connected.is_empty());

            if still_empty {
                tracing::info!("Unloaded {map_id:?}");
                maps.remove(&map_id);
            }
        }
    }
}

async fn next_client_id(state: &AppState, map: MapId) -> Result<ClientId> {
    let server_id = state.id.0;
    assert!(server_id < 2_u64.pow(8));

    let record = sqlx::query!(
        "
INSERT INTO next_client_id (map_id, server_id, next_suffix)
VALUES ($1, $2, $3)
ON CONFLICT (map_id, server_id)
    DO UPDATE SET next_suffix = next_client_id.next_suffix + 1
RETURNING next_suffix
        ",
        map.into_inner(),
        server_id as i32,
        i64::MIN,
    )
    .fetch_one(&state.db)
    .await?;

    // Shift the range from [-2^63, 2^63) to [0, 2^64)
    let suffix = (record.next_suffix as i128 - i64::MIN as i128) as u64;

    assert!(suffix < 2_u64.pow(56));
    let value = server_id << 56 | suffix;

    Ok(ClientId(value))
}

async fn get_map_state(state: Arc<AppState>, map_id: MapId) -> Result<Arc<MapState>> {
    {
        let map_states = state.maps.lock();
        if let Some(value) = map_states.get(&map_id) {
            return Ok(value.clone());
        }
    }

    let client = load_client(&state, map_id).await?;
    let value = Arc::new(MapState {
        id: map_id,
        client: Mutex::new(client),
        connected: Mutex::default(),
        broadcast: broadcast::channel(16).0,
        disconnect: broadcast::channel(16).0,
    });

    let state_for_worker = state.clone();
    let mut map_states = state.maps.lock();
    if let Some(value) = map_states.get(&map_id) {
        // If we raced with another thread use their value.
        Ok(value.clone())
    } else {
        map_states.insert(map_id, value.clone());
        spawn_map_worker(state_for_worker, value.clone());
        Ok(value)
    }
}

fn spawn_map_worker(app_state: Arc<AppState>, state: Arc<MapState>) {
    let inner_app_state = app_state.clone();
    let inner_state = state.clone();
    let inner = || async move {
        let app_state = inner_app_state;
        let state = inner_state;

        let map_id = state.id;
        tracing::info!("Started map worker {map_id:?}");

        loop {
            tokio::select! {
                _ = sleep(SAVE_INTERVAL) => {}
                _ = app_state.shutdown.recv() => {}
            }

            let saved_at = Utc::now().naive_utc();

            let mut b = TypedBuilder::<save_capnp::save::Owned>::new_default();
            state.client.lock().save(b.init_root());
            let mut save = Vec::new();
            serialize_packed::write_message(&mut save, b.borrow_inner())?;

            sqlx::query!(
                "
INSERT INTO map_saves (map_id, server_id, client, saved_at)
VALUES ($1, $2, $3, $4)
ON CONFLICT (map_id, server_id)
DO UPDATE SET client = $3, saved_at = $4
                ",
                map_id.into_inner(),
                app_state.id.into_inner() as i32,
                &save,
                saved_at,
            )
            .execute(&app_state.db)
            .await?;

            tracing::trace!("Saved {:?} ({} bytes)", state.id, save.len());

            if app_state.shutdown.in_progress() {
                while Arc::strong_count(&state) > 1 {
                    // We need to make sure this busy-loop doesn't starve the
                    // websocket handlers we're waiting for.
                    sleep(Duration::from_millis(10)).await;
                }
            }

            if Arc::strong_count(&state) == 1 {
                // No one can ever be connected to this map state again
                tracing::info!("Stopping map worker {:?}", state.id);
                break;
            }
        }

        Ok::<(), eyre::Report>(())
    };

    tokio::spawn(async move {
        let _guard = app_state.shutdown.inhibit();
        let tx_disconnect = state.disconnect.clone();
        if let Err(err) = inner().await {
            tracing::error!("Error in map worker: {err}");
            let _ = tx_disconnect.send(Disconnect::All);
        }
    });
}

#[instrument(skip(state))]
async fn load_client(state: &AppState, map_id: MapId) -> Result<Client> {
    let record = sqlx::query!(
        "SELECT client, saved_at FROM map_saves WHERE map_id = $1 AND server_id = $2",
        map_id.0,
        state.id.0 as i32,
    )
    .fetch_optional(&state.db)
    .await?;

    let rng = ChaCha20Rng::from_entropy();

    match record {
        Some(record) => {
            tracing::info!(
                "Restoring client from save at {} ({} bytes)",
                record.saved_at,
                record.client.len()
            );
            let save = serialize_packed::read_message(&*record.client, ReaderOptions::default())?;
            let save: save_capnp::save::Reader = save.get_root()?;
            Client::restore(save, rng).map_err(Into::into)
        }
        None => {
            tracing::info!("Creating new empty client");
            Ok(Client::new(state.id, map_id, rng))
        }
    }
}

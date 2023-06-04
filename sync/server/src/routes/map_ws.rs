use super::prelude::*;
use crate::workers;

#[instrument(skip(ws, app_state))]
pub async fn upgrade(
    Path(map_id): Path<Uuid>,
    ConnectInfo(addr): ConnectInfo<SocketAddr>,
    ws: WebSocketUpgrade,
    State(app_state): State<Arc<AppState>>,
) -> impl IntoResponse {
    let map = MapId(map_id);
    Ok::<_, StatusCode>(ws.on_upgrade(move |socket| handler(app_state, socket, addr, map)))
}

#[instrument(skip(app_state, socket))]
async fn handler(app_state: Arc<AppState>, socket: WebSocket, addr: SocketAddr, map: MapId) {
    let handle = match get_worker(&app_state, map).await {
        Ok(client) => client,
        Err(error) => {
            tracing::error!(%error, "Failed to load client");
            return;
        }
    };

    if let Err(e) = handle.connect(addr, socket).await {
        tracing::error!(?map, ?addr, "map_ws on_upgrade connect failed: {e}");
    }
}

async fn get_worker(app_state: &Arc<AppState>, map: MapId) -> Result<workers::map_sync::Handle> {
    {
        let workers = app_state.map_workers.lock();
        if let Some(handle) = workers.get(&map) {
            if handle.is_live() {
                return Ok(handle.clone());
            }
        }
    }

    let client = load_client(&app_state, map).await?;

    {
        let app_state_for_worker = app_state.clone();
        let mut workers = app_state.map_workers.lock();

        if let Some(handle) = workers.get(&map) {
            if handle.is_live() {
                return Ok(handle.clone());
            }
        }

        let handle = workers::map_sync::spawn(app_state_for_worker, client);
        workers.insert(map, handle.clone());
        return Ok(handle);
    }
}

#[instrument(skip(state))]
async fn load_client(state: &AppState, map_id: MapId) -> Result<Client> {
    let save = db::load_client(&state.db, map_id, state.id).await?;
    let rng = ChaCha20Rng::from_entropy();

    let mut client = match save {
        Some(save) => {
            let save = serialize_packed::read_message(&*save, ReaderOptions::default())?;
            let save: save_capnp::save::Reader = save.get_root()?;
            Client::restore(save, rng)?
        }
        None => {
            tracing::info!("Creating new empty client");
            Client::new(state.id, map_id, rng)
        }
    };

    client.set_aware(
        &mut Vec::new(),
        state.id,
        Some(sync_core::Aware {
            is_server: true,
            ..Default::default()
        }),
    );

    Ok(client)
}

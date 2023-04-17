use crate::Disconnect;

use super::prelude::*;

const SAVE_INTERVAL: Duration = Duration::from_secs(10);

#[instrument(skip(token, ws, state))]
pub async fn upgrade(
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
        handler(
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

#[instrument(skip(socket, state))]
async fn handler(
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

            let mut b = TypedBuilder::<save_capnp::save::Owned>::new_default();
            state.client.lock().save(b.init_root());
            let mut save = Vec::new();
            serialize_packed::write_message(&mut save, b.borrow_inner())?;

            db::save_client(&app_state.db, map_id, app_state.id, &save).await?;

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
    let save = db::load_client(&state.db, map_id, state.id).await?;
    let rng = ChaCha20Rng::from_entropy();

    match save {
        Some(save) => {
            let save = serialize_packed::read_message(&*save, ReaderOptions::default())?;
            let save: save_capnp::save::Reader = save.get_root()?;
            Client::restore(save, rng).map_err(Into::into)
        }
        None => {
            tracing::info!("Creating new empty client");
            Ok(Client::new(state.id, map_id, rng))
        }
    }
}

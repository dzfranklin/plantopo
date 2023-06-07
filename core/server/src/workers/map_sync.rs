use axum::extract::ws::{self, WebSocket};
use tracing::Instrument;

#[allow(unused)]
use sync_capnp::{
    ACCESS_FORBIDDEN_ERROR, INVALID_ERROR, PARSE_ERROR, SERVER_ERROR, WRITE_FORBIDDEN_ERROR,
};

use crate::{
    check_token::{check_token, ValidParsedToken},
    prelude::*,
};
use common::{sync_capnp, LInstant};

const SAVE_INTERVAL: Duration = Duration::from_secs(10);
const IDLE_TIMEOUT: Duration = Duration::from_secs(30);
const HEARTBEAT_INTERVAL: Duration = Duration::from_secs(15);

type OwnedReader = capnp::message::Reader<capnp::serialize::OwnedSegments>;

#[derive(Clone)]
pub struct Handle {
    map: MapId,
    connect: mpsc::Sender<(SocketAddr, WebSocket)>,
}

impl Handle {
    pub async fn connect(&self, addr: SocketAddr, socket: WebSocket) -> Result<()> {
        self.connect
            .send((addr, socket))
            .await
            .map_err(|_| eyre!("{:?} connect channel closed", self.map))
    }

    /// If the worker panics this will return false
    pub fn is_live(&self) -> bool {
        !self.connect.is_closed()
    }
}

impl fmt::Debug for Handle {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.debug_struct("Handle")
            .field("map", &self.map)
            .field("is_live", &self.is_live())
            .finish_non_exhaustive()
    }
}

struct Peer {
    addr: SocketAddr,
    state: PeerState,
    sender: SplitSink<WebSocket, ws::Message>,
}

impl fmt::Debug for Peer {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.debug_struct("Peer")
            .field("addr", &self.addr)
            .field("state", &self.state)
            .finish_non_exhaustive()
    }
}

#[derive(Debug, Clone, Copy)]
enum PeerState {
    Authed(ValidParsedToken),
    PreAuth,
}

impl PeerState {
    fn is_authed(&self) -> bool {
        matches!(self, PeerState::Authed(_))
    }
}

struct SavedAware {
    updated_at: Instant,
    entry: common::Aware,
}

pub(crate) fn spawn(app_state: Arc<AppState>, client: Client) -> Handle {
    let (connect_tx, connect_rx) = mpsc::channel::<(SocketAddr, WebSocket)>(64);
    let map = client.map_id();

    let span = tracing::info_span!(
        "map_sync",
        ?map,
        server_id = ?app_state.id,
    );

    tokio::spawn(run(app_state, client, connect_rx).instrument(span));

    Handle {
        map,
        connect: connect_tx,
    }
}

async fn run(
    app_state: Arc<AppState>,
    mut client: Client,
    mut connect_rx: mpsc::Receiver<(SocketAddr, WebSocket)>,
) {
    let shutdown = app_state.shutdown.clone();
    let server_id = app_state.id;
    let db = app_state.db.clone();

    let mut connected: HashMap<SocketAddr, Peer> = HashMap::new();
    let mut recv_all: SelectAll<RecvStream> = SelectAll::new();

    let idle_timeout = sleep(IDLE_TIMEOUT);
    tokio::pin!(idle_timeout);

    let mut heartbeat_interval = interval(HEARTBEAT_INTERVAL);
    heartbeat_interval.set_missed_tick_behavior(MissedTickBehavior::Skip);
    heartbeat_interval.tick().await; // Skip the first, which completes immediately

    let mut save_interval = interval(SAVE_INTERVAL);
    save_interval.set_missed_tick_behavior(MissedTickBehavior::Skip);
    save_interval.tick().await; // Skip the first, which completes immediately

    let mut needs_save = false;
    let last_save_failed = Arc::new(AtomicBool::new(false));
    let mut save_buf = Vec::with_capacity(1024);

    // TODO: Save
    let mut saved_awares: HashMap<UserId, SavedAware> = HashMap::new();

    tracing::info!("Spawned map worker");

    // TODO: Save a single delta, then compact after. That way we can ack deltas quickly?

    loop {
        select! {
        _ = shutdown.recv() => {
            tracing::debug!("Worker received shutdown");
            break;
        }

        _ = &mut idle_timeout => {
            if connected.is_empty() {
                tracing::debug!("Idle timeout, shutting down");
                break;
            } else {
                idle_timeout.as_mut().reset(Instant::now() + IDLE_TIMEOUT);
            }
        }

        _ = save_interval.tick() => {
            if !needs_save && !last_save_failed.load(atomic::Ordering::Acquire) {
                continue;
            }
            needs_save = false;

            let mut b = MessageBuilder::new_default();
            client.save(b.init_root());
            save_buf.clear();
            serialize_packed::write_message(&mut save_buf, &b).expect("infallible writer");

            let save_buf = save_buf.clone();
            let db = db.clone();
            let last_save_failed = last_save_failed.clone();
            let map_id = client.map_id();
            tokio::spawn(async move {
                let res = db::save_client(&db, map_id, server_id, &save_buf).await;
                match res {
                    Ok(()) => {
                        last_save_failed.store(false, atomic::Ordering::Release);
                    }
                    Err(error) => {
                        tracing::warn!(%error, "Regular save failed");
                        last_save_failed.store(true, atomic::Ordering::Release);
                    }
                }
            });
        }

        _ = heartbeat_interval.tick() => {
            // Send the server's aware
            todo!();
            // let mut msg = Delta::new(None);
            // client.write_my_aware(&mut msg.aware);
            // let msg = msg.serialize();

            // for (_, entry) in connected.iter_mut() {
            //     let _ = entry.sender.send(ws::Message::Binary(msg.clone())).await;
            // }
        }

        Some((addr, socket)) = connect_rx.recv() => {
            tracing::info!(?addr, "Connecting");

            if connected.contains_key(&addr) {
                tracing::info!(?addr, "Addr already connected, refusing");
                let _ = socket.close().await;
                continue;
            }

            idle_timeout.as_mut().reset(Instant::now() + IDLE_TIMEOUT);

            let (sender, receiver) = socket.split();

            connected.insert(addr, Peer {
                addr,
                state: PeerState::PreAuth,
                sender,
            });

            recv_all.push(RecvStream { addr, inner: receiver });
        }

        Some((addr, req)) = recv_all.next() => {
            let Some(sender) = connected.get_mut(&addr) else {
                tracing::info!(?addr, "Ignoring message from client not in connected");
                continue;
            };

            idle_timeout.as_mut().reset(Instant::now() + IDLE_TIMEOUT);

            let req_bytes = match req {
                Ok(ws::Message::Binary(msg)) => msg,
                Ok(ws::Message::Ping(_) | ws::Message::Pong(_)) => continue,
                Ok(ws::Message::Close(_)) | Err(_) => {
                    let state = sender.state;
                    drop(sender);
                    connected.remove(&addr);

                    if let PeerState::Authed(state) = state {
                        tracing::info!(?addr, ?state, "Disconnecting");

                        todo!();
                        // let _ = client.set_aware(MessageBuilder::new_default().init_root(), state.client_id, None);

                        let mut b = MessageBuilder::new_default();
                        {
                            let b = b.init_root::<sync_capnp::message::Builder>();
                            let mut b = b.init_aware().init_value(1).get(0);
                            b.set_client(state.client_id.into());
                            b.set_disconnect(true);
                        }
                        let mut out = Vec::with_capacity(64);
                        serialize_packed::write_message(&mut out, &b).expect("infallible writer");

                        for entry in connected.values_mut() {
                            let _ = entry.sender.send(ws::Message::Binary(out.clone())).await;
                        }
                    } else {
                        tracing::info!(?addr, "Disconnected pre-auth");
                    }

                    continue;
                }
                Ok(msg) => {
                    tracing::info!(?addr, ?msg, "Ignoring non-binary message");
                    continue;
                }
            };
            let reader = match serialize_packed::read_message(&*req_bytes, ReaderOptions::default()) {
                Ok(reader) => reader,
                Err(err) => {
                    tracing::info!(?err, ?addr, "Error parsing message");
                    continue;
                }
            };
            tracing::trace!(?addr, reader=?reader.get_root::<sync_capnp::message::Reader>(), "recv");

            let res = match sender.state {
                PeerState::PreAuth => {
                    handle_pre_auth_recv(
                        client.map_id(),
                        addr,
                        reader,
                        &app_state,
                        &mut connected,
                        &mut client,
                        save_buf.len(),
                        &saved_awares
                    )
                        .instrument(tracing::info_span!("handle_pre_auth_recv", ?addr))
                        .await
                }
                PeerState::Authed(state) => {
                    handle_authed_recv(
                        addr,
                        &req_bytes,
                        reader,
                        state,
                        &mut connected,
                        &mut client,
                        &*last_save_failed,
                        &mut needs_save,
                        &mut saved_awares,
                    )
                    .instrument(tracing::info_span!("handle_authed_recv", ?addr, ?state))
                    .await
                }
            };

            if let Err(reply) = res {
                tracing::info!(?reply, ?addr, "Sending error");

                let mut b = MessageBuilder::new_default();
                {
                    let mut b = b.init_root::<sync_capnp::message::Builder>().init_error();
                    b.set_code(reply.code);
                    b.set_description(&reply.description);
                }

                let mut out = Vec::with_capacity(128);
                serialize_packed::write_message(&mut out, &b).expect("infallible writer");

                let reply = ws::Message::Binary(out);
                let entry = connected.get_mut(&addr).expect("Must be in connected");
                let _ = entry.sender.send(reply).await;
            }
        }

        else => { break; }
        }
    }

    {
        let mut workers = app_state.map_workers.lock();
        workers.remove(&client.map_id());
    }

    if needs_save {
        let mut b = MessageBuilder::new_default();
        client.save(b.init_root());

        save_buf.clear();
        serialize_packed::write_message(&mut save_buf, &b).expect("infallible writer");

        let res = db::save_client(&app_state.db, client.map_id(), app_state.id, &save_buf).await;
        if let Err(error) = res {
            tracing::warn!(?error, "Final client save failed");
        }
    }

    tracing::info!("Stopped map sync worker");
}

async fn handle_pre_auth_recv(
    map: MapId,
    sender: SocketAddr,
    req: OwnedReader,
    app_state: &AppState,
    connected: &mut HashMap<SocketAddr, Peer>,
    client: &mut Client,
    save_cap: usize,
    saved_awares: &HashMap<UserId, SavedAware>,
) -> Result<(), ErrReply> {
    // Check auth
    let token = {
        let req = req.get_root::<sync_capnp::message::Reader>()?;
        use sync_capnp::message::Which;
        if let Ok(Which::Auth(auth)) = req.which() {
            let auth = auth?;

            if !auth.has_token() {
                return Err(ErrReply {
                    code: INVALID_ERROR,
                    description: "Missing auth token".into(),
                });
            }
            let token = auth.get_token()?;

            let token = check_token(&app_state.token_secret, map, token).map_err(|_| ErrReply {
                code: ACCESS_FORBIDDEN_ERROR,
                description: "Invalid or incorrect auth token".into(),
            })?;

            for peer in connected.values_mut() {
                if let PeerState::Authed(state) = &peer.state {
                    if state.client_id == token.client_id {
                        return Err(ErrReply {
                            code: INVALID_ERROR,
                            description: "Client id already connected".into(),
                        });
                    }
                }
            }

            let sender = connected.get_mut(&sender).expect("Must be in connected");
            assert!(!sender.state.is_authed(), "caller checks is PreAuth");
            sender.state = PeerState::Authed(token);
            token
        } else {
            return Err(ErrReply {
                code: INVALID_ERROR,
                description: "Expected auth message".into(),
            });
        }
    };

    let sender = connected.get_mut(&sender).expect("Must be in connected");
    let sender = &mut sender.sender;

    // Send state
    let mut out = Vec::with_capacity(save_cap);
    let mut b = MessageBuilder::new_default();
    todo!();
    // client.write_state(b.init_root::<sync_capnp::message::Builder>().init_delta());
    serialize_packed::write_message(&mut out, &b).expect("infallible writer");
    let _ = sender.send(ws::Message::Binary(out)).await;

    // Set initial aware to the entry saved for this user, if logged in
    if let Some(user) = token.user_id {
        if let Some(entry) = saved_awares.get(&user) {
            let mut b = MessageBuilder::new_default();
            todo!();
            // client.set_aware(b.init_root(), token.client_id, Some(&entry.entry))?;
        }
    }

    // Send awares
    let mut out = Vec::with_capacity(save_cap);
    let mut b = MessageBuilder::new_default();
    todo!();
    // client.write_aware(b.init_root::<sync_capnp::message::Builder>().init_aware());
    serialize_packed::write_message(&mut out, &b).expect("infallible writer");
    let _ = sender.send(ws::Message::Binary(out)).await;

    Ok(())
}

async fn handle_authed_recv(
    sender: SocketAddr,
    req_bytes: &[u8],
    req: OwnedReader,
    peer_info: ValidParsedToken,
    connected: &mut HashMap<SocketAddr, Peer>,
    client: &mut Client,
    last_save_failed: &AtomicBool,
    needs_save: &mut bool,
    saved_awares: &mut HashMap<UserId, SavedAware>,
) -> Result<(), ErrReply> {
    let mut should_broadcast = false;
    let mut should_confirm_delta: Option<LInstant> = None;

    {
        let req = req.get_root::<sync_capnp::message::Reader>()?;
        use sync_capnp::message::Which;
        match req.which() {
            Ok(Which::Auth(_)) => {
                return Err(ErrReply {
                    code: INVALID_ERROR,
                    description: "You are already authenticated".into(),
                })
            }
            Ok(Which::Aware(aware)) => {
                let aware = aware?;

                let values = aware.get_value()?;
                match values.len() {
                    0 => {}
                    1 => {
                        let reader = values.get(0);
                        let (aware_client, entry) = common::aware::read_entry(reader)?;

                        if aware_client != peer_info.client_id {
                            return Err(ErrReply {
                                code: INVALID_ERROR,
                                description: "Client id doesn't match aware".into(),
                            });
                        }

                        todo!();
                        // client.aware_mut().merge(aware);

                        if let Some(user) = peer_info.user_id {
                            if let Some(entry) = entry {
                                saved_awares.insert(
                                    user,
                                    SavedAware {
                                        entry,
                                        updated_at: Instant::now(),
                                    },
                                );
                            }
                        }

                        should_broadcast = true;
                    }
                    _ => {
                        return Err(ErrReply {
                            code: INVALID_ERROR,
                            description: "Client cannot send multiple awares to server".into(),
                        })
                    }
                }
            }
            Ok(Which::Delta(delta)) => {
                tracing::debug!("Received delta");
                if !peer_info.permit_write {
                    return Err(ErrReply {
                        code: WRITE_FORBIDDEN_ERROR,
                        description: "You lack write permission".into(),
                    });
                }

                let delta = delta?;
                let delta_ts = common::read_delta_ts(delta)?;
                client.merge(delta)?;

                *needs_save = true;
                should_broadcast = true;
                should_confirm_delta = Some(delta_ts);
            }
            Ok(Which::Error(err)) => {
                if !req.has_error() {
                    // Since Error is the first variant it is the default
                    return Err(ErrReply {
                        code: INVALID_ERROR,
                        description: "Empty message".into(),
                    });
                }
                tracing::debug!("Received error");

                let err = err?;
                let code = err.get_code();
                let description = err.get_description()?;

                tracing::info!(?sender, ?code, ?description, "Client sent error");
            }
            Ok(Which::ConfirmDelta(_)) => {
                tracing::debug!("Received confirm delta");
                // We don't care about confirmations in this direction
            }
            Err(capnp::NotInSchema(variant)) => {
                tracing::info!(?sender, ?variant, "Client sent unknown message type");
                return Ok(());
            }
        }
    }

    // We can't hold the Reader across an await point because it isn't Send so
    // we use this awkward hoisting.
    //
    // This may be unnecessary: See <https://github.com/capnproto/capnproto-rust/issues/256>

    if should_broadcast {
        for (peer, entry) in connected.iter_mut() {
            if *peer == sender {
                continue;
            }

            let msg = ws::Message::Binary(req_bytes.to_vec());
            let _ = entry.sender.send(msg).await;
        }
    }

    if let Some(delta_ts) = should_confirm_delta {
        if last_save_failed.load(atomic::Ordering::Acquire) {
            tracing::warn!("Not confirming delta because last save failed");
        } else {
            let entry = connected.get_mut(&sender).expect("Must be in connected");

            let mut b = MessageBuilder::new_default();
            common::write_confirm_delta(b.init_root(), delta_ts);

            let mut out = Vec::with_capacity(32);
            serialize_packed::write_message(&mut out, &b).expect("infallible writer");

            let msg = ws::Message::Binary(out);
            let _ = entry.sender.send(msg).await;
        }
    }

    Ok(())
}

#[derive(Debug)]
struct ErrReply {
    code: u16,
    description: Cow<'static, str>,
}

impl From<common::Error> for ErrReply {
    fn from(err: common::Error) -> Self {
        if let Some(source) = err.source() {
            if source.downcast_ref::<capnp::Error>().is_some() {
                return Self {
                    code: PARSE_ERROR,
                    description: "Failed to parse message".into(),
                };
            }
        }

        Self {
            code: INVALID_ERROR,
            description: err.to_string().into(),
        }
    }
}

impl From<capnp::Error> for ErrReply {
    fn from(_: capnp::Error) -> Self {
        Self {
            code: PARSE_ERROR,
            description: "Failed to parse message".into(),
        }
    }
}

#[pin_project]
struct RecvStream {
    addr: SocketAddr,
    #[pin]
    inner: SplitStream<WebSocket>,
}

impl Stream for RecvStream {
    type Item = (SocketAddr, Result<ws::Message, axum::Error>);

    fn poll_next(
        self: std::pin::Pin<&mut Self>,
        cx: &mut std::task::Context<'_>,
    ) -> std::task::Poll<Option<Self::Item>> {
        let this = self.project();
        match this.inner.poll_next(cx) {
            Poll::Ready(res) => match res {
                Some(res) => Poll::Ready(Some((*this.addr, res))),
                None => Poll::Ready(None),
            },
            Poll::Pending => Poll::Pending,
        }
    }
}

use std::{
    collections::HashMap,
    fmt,
    net::SocketAddr,
    sync::{Arc, Mutex, TryLockError},
    time::Duration,
};

use axum::extract::ws::{self, WebSocket};
use futures_util::{stream::SplitSink, SinkExt, StreamExt};
use plantopo_schema::{
    sync_capnp::{self, CloseStatus},
    ClientId, LInstant, PInstant,
};
use tokio::{
    pin, select,
    sync::mpsc,
    time::{sleep, Instant},
};
use tokio_stream::{StreamMap, StreamNotifyClose};
use tokio_util::sync::CancellationToken;
use uuid::Uuid;

use crate::{map_state::VerifiedUserMeta, MapState};

#[derive(Clone)]
pub struct Dispatcher(Arc<std::sync::Mutex<Inner>>);

#[derive(Debug)]
pub struct AuthorizedSocket {
    pub client_id: ClientId,
    pub map: Uuid,
    pub addr: SocketAddr,
    pub socket: WebSocket,
    pub user: Option<VerifiedUserMeta>,
}

#[derive(Debug)]
struct Inner {
    acceptors: HashMap<Uuid, mpsc::UnboundedSender<AuthorizedSocket>>,
    shutdown_start: CancellationToken,
    shutdown_inhibit: Option<mpsc::Sender<()>>,
    shutdown_complete: Option<mpsc::Receiver<()>>,
}

impl fmt::Debug for Dispatcher {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self.0.try_lock() {
            Ok(inner) => f
                .debug_struct("Dispatcher")
                .field("in_shutdown", &inner.shutdown_start.is_cancelled())
                .field("acceptors", &inner.acceptors)
                .finish_non_exhaustive(),
            Err(TryLockError::WouldBlock) => write!(f, "Dispatcher(<locked>)"),
            Err(TryLockError::Poisoned(err)) => write!(f, "Dispatcher(<poisoned: {err}>)"),
        }
    }
}

impl Dispatcher {
    pub fn new() -> Self {
        let (shutdown_inhibit, shutdown_complete) = mpsc::channel(1);
        Self(Arc::new(Mutex::new(Inner {
            acceptors: HashMap::with_capacity(4096),
            shutdown_start: CancellationToken::new(),
            shutdown_inhibit: Some(shutdown_inhibit),
            shutdown_complete: Some(shutdown_complete),
        })))
    }

    /// Returns once the shutdown is complete and all the clients have been
    /// gracefully disconnected.
    ///
    /// # Panics
    ///
    /// If called more than once.
    #[tracing::instrument]
    pub async fn shutdown(&self) {
        tracing::info!("Starting dispatcher shutdown");
        let mut shutdown_complete = {
            let mut lock = self.0.lock().unwrap();
            lock.shutdown_start.cancel();
            drop(lock.shutdown_inhibit.take());
            lock.shutdown_complete
                .take()
                .expect("shutdown can only be called once")
        };
        let _ = shutdown_complete.recv().await;
        tracing::info!("Dispatcher shutdown complete");
    }

    #[tracing::instrument]
    pub async fn accept(&self, socket: AuthorizedSocket) {
        let map = socket.map;
        let lock = self.0.lock().unwrap();

        if lock.shutdown_start.is_cancelled() {
            tracing::info!("refusing dispatch as in shutdown");
            return;
        }

        if let Some(acceptor) = lock.acceptors.get(&map) {
            match acceptor.send(socket) {
                Ok(_) => {
                    tracing::info!("sent to existing worker");
                    return;
                }
                Err(err) => {
                    tracing::info!("discovered worker is dead");
                    socket = err.0;
                }
            }
        }

        let (accept_sender, accept_receiver) = mpsc::unbounded_channel();

        accept_sender.send(socket).expect("can't be full/closed");

        tokio::spawn(worker(
            map,
            accept_receiver,
            lock.shutdown_start.clone(),
            lock.shutdown_inhibit.clone().expect("not in shutdown"),
        ));

        tracing::info!("started worker");

        {
            let mut lock = self.0.lock().unwrap();
            lock.acceptors.insert(map, accept_sender);
        }
    }
}

const IDLE_TIMEOUT: Duration = Duration::from_secs(60 * 10);
const WS_NORMAL_CLOSE: u16 = 1000;
const WS_CUSTOM_CLOSE: u16 = 3000;

type SyncMessageBuilder = capnp::message::TypedBuilder<sync_capnp::sync_message::Owned>;

#[derive(Debug)]
struct SocketEntry {
    pub addr: SocketAddr,
    pub user: Option<VerifiedUserMeta>,
    pub sender: SplitSink<WebSocket, ws::Message>,
}

pub async fn worker(
    map: Uuid,
    mut acceptor: mpsc::UnboundedReceiver<AuthorizedSocket>,
    shutdown_start: CancellationToken,
    _shutdown_inhibit: mpsc::Sender<()>,
) {
    let idle = sleep(IDLE_TIMEOUT);
    pin!(idle);

    let mut connected: HashMap<ClientId, SocketEntry> = HashMap::new();
    let mut recv_all = StreamMap::new();
    let mut state = MapState::new(map, ClientId::default());
    let mut pending_disconnect = None;

    loop {
        idle.as_mut().reset(Instant::now() + IDLE_TIMEOUT);

        if let Some(client) = pending_disconnect.take() {
            connected.remove(&client);
            recv_all.remove(&client);
            state.disconnect(client);

            // TODO: Wait a sec! this should be json

            let msg = disconnect_message(state.now(), client);
            for (&peer, entry) in connected.iter_mut() {
                if peer != client {
                    let _ = entry.sender.send(ws::Message::Binary(msg.clone())).await;
                }
            }
        }

        select! {
            _ = shutdown_start.cancelled() => break,
            _ = idle.as_mut() => break,

            Some(socket) = acceptor.recv() => {
                tracing::info!(?socket, "accepting");
                let AuthorizedSocket { client_id, map, addr, socket, user } = socket;
                let (sender, receiver) = socket.split();

                if let Some(user) = user.as_ref() {
                    state.authenticate(client_id, user.clone());
                }

                recv_all.insert(client_id, StreamNotifyClose::new(receiver));
                connected.insert(client_id, SocketEntry { addr, sender, user});
            }

            Some((client_id, msg)) = recv_all.next() => {
                let msg = match msg {
                    Some(Ok(msg)) => msg,
                    Some(Err(err)) => {
                        tracing::info!("error receiving: {err}");
                        pending_disconnect = Some(client_id);
                        continue;
                    }
                    None => {
                        tracing::info!("client disconnected");
                        pending_disconnect = Some(client_id);
                        continue;
                    }
                };

                match msg {
                    ws::Message::Ping(_) | ws::Message::Pong(_) => continue,
                    ws::Message::Close(reason) => {
                        tracing::info!(?reason, "got close");
                        pending_disconnect = Some(client_id);
                        let Some(reason) = reason else { continue };
                        if reason.code != WS_NORMAL_CLOSE {
                            let code = reason.code.saturating_sub(WS_CUSTOM_CLOSE);
                            match sync_capnp::ErrorCode::try_from(code) {
                                Ok(code) => tracing::warn!(?code, "received non-normal close"),
                                Err(code) => tracing::warn!(?code, "failed to parse close reason"),
                            }
                        }
                    }
                }
            }
        }
    }

    todo!("closing stuff")
}

fn disconnect_message(now: LInstant, client: ClientId) -> Vec<u8> {
    let mut b = SyncMessageBuilder::new_default();
    let mut root = b.init_root();
    root.set_lts(now.inner());
    root.set_pts(PInstant::now().inner());
    root.set_disconnected(client.inner());

    let mut out = Vec::with_capacity(32);
    capnp::serialize_packed::write_message(&mut out, root).expect("infallible writer");
    out
}

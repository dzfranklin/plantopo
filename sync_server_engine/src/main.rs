use std::{
    collections::HashMap,
    env::{self, args},
    hash::Hash,
    str::FromStr,
    sync::Arc,
    time::Duration,
};

#[allow(unused)]
use eyre::{eyre, WrapErr};

use chrono::offset::Utc;
use erlang_port::{IOPort, PortReceive, PortSend};
use lib0::any::Any as YAny;
use serde::{Deserialize, Serialize};
use serde_bytes::ByteBuf;
use sqlx::{postgres::PgPoolOptions, Pool, Postgres};
use tokio::{select, spawn, sync::oneshot, time::sleep, task::spawn_blocking};
use uuid::Uuid;
use y_sync::{
    awareness::Awareness,
    sync::{self, Message, SyncMessage},
};
use yrs::{
    types::ToJson,
    updates::{
        decoder::{Decode, DecoderV1},
        encoder::{Encode, Encoder, EncoderV1},
    },
    Doc, Map, ReadTxn, Snapshot, StateVector, Transact, TransactionMut, Update,
};

const SAVE_INTERVAL: Duration = Duration::from_secs(10);
const FALLBACK_ZOOM: f64 = 8.0;

// NOTE: We aren't sent users that can't view the document, so we only check edit operations

#[derive(Debug, Deserialize, Serialize, Hash, Eq, PartialEq, Clone, Copy)]
struct SocketId(u32);

#[derive(Debug, Deserialize)]
enum Input {
    Connect {
        socket: SocketId,
        meta: InputSocketMeta,
        fallback_center: Center,
    },
    Recv(SocketId, ByteBuf),
    Leave(SocketId),
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "snake_case")]
enum Output {
    Send(SocketId, ByteBuf),
    Broadcast(ByteBuf),
    SocketFatalError(SocketId, String),
}

#[derive(Debug, Deserialize)]
struct InputSocketMeta {
    user: Option<UserId>,
    role: Role,
}
#[derive(Debug, Clone)]
struct SocketMeta {
    user: Option<UserId>,
    role: Role,
}

#[derive(Debug, Serialize, Deserialize, Clone, Copy, Hash, PartialEq, Eq)]
struct UserId(Uuid);

#[derive(Debug, Deserialize, Copy, Clone, Eq, PartialEq)]
enum Role {
    Viewer,
    Editor,
    Owner,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Default)]
struct Center(f64, f64);

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Default)]
struct ViewAt {
    center: Center,
    zoom: f64,
    pitch: f64,
    bearing: f64,
}

#[allow(non_snake_case)]
#[derive(Debug, Deserialize, Serialize, Clone, Default)]
struct AwarenessJson {
    viewAt: Option<ViewAt>,
    #[serde(flatten)]
    other: HashMap<String, serde_json::Value>,
}

#[derive(Debug, Clone, Copy)]
struct MapId(Uuid);

type Sockets = HashMap<SocketId, SocketMeta>;
type UserViewAts = HashMap<UserId, ViewAt>;
type Db = Arc<Pool<Postgres>>;

const INITIAL_VIEW_AT_TAG: u8 = 10;

macro_rules! log {
    ($fmt:literal) => {
        log!($fmt,)
    };
    ($fmt:literal,$($arg:tt)*) => {
        eprint!(concat!("[sync_server_engine]: ", $fmt, "\r\n"), $($arg)*)
    };
}

#[tokio::main]
async fn main() -> eyre::Result<()> {
    let args: Vec<String> = args().skip(1).collect();
    let map_id = args.get(0).ok_or_else(|| eyre!("missing map id arg"))?;
    let map_id = MapId(Uuid::from_str(map_id).wrap_err("parse map id")?);

    let IOPort {
        sender,
        mut receiver,
    } = unsafe {
        use erlang_port::PacketSize;
        erlang_port::nouse_stdio(PacketSize::Four)
    };

    let db_url = env::var("DATABASE_URL").wrap_err("DATABASE_URL")?;
    // TODO: This will exhaust the 100 max conns. We should pool above ecto & this
    let db = PgPoolOptions::new()
        .max_connections(10)
        .connect(&db_url)
        .await?;
    let db = Arc::new(db);

    let aware = {
        let doc = create_doc();
        if let Some(state) = Option::<Vec<u8>>::None {
            // todo load from db
            let state = Update::decode_v1(&state)?;
            let mut tx = doc.transact_mut();
            tx.apply_update(state);
        }
        Arc::new(parking_lot::Mutex::new(Awareness::new(doc)))
    };

    let user_view_ats: Arc<parking_lot::Mutex<UserViewAts>> = Default::default();

    let (tx_close, mut rx_close) = oneshot::channel::<eyre::Result<()>>();

    // Main loop
    let aware2 = aware.clone();
    let db2 = db.clone();
    let user_view_ats2 = user_view_ats.clone();
    spawn_blocking(move || {
        let mut sockets: Sockets = Default::default();
        let sender = Arc::new(parking_lot::Mutex::new(sender));
        // TODO: Add a pr for a failable api for erlang_port so we save if the fd is closed
        // instead of just crashing on a broken pipe. This happens if the engine.ex crashes
        let send = move |val: Output| sender.lock().send(val);
        let send = Box::leak(Box::new(send));


        // TODO: Add a pr for a failable api for erlang_port so we save if we
        // get an invalid msg instead of just crashing
        for input in receiver.iter::<Input>() {
            let mut aware = aware2.lock();
            let mut user_view_ats = user_view_ats2.lock();
            if let Err(err) = process(
                map_id,
                &db2,
                &mut aware,
                &mut sockets,
                &mut user_view_ats,
                input,
                &*send,
            ) {
                tx_close.send(Err(err)).unwrap();
                return;
            }
        }

        tx_close.send(Ok(())).expect("Failed to send close ok");
    });

    // Save loop
    loop {
        let mut done = None;
        select! {
            res = &mut rx_close => {
                done = Some(res.unwrap());
             }
            _ = sleep(SAVE_INTERVAL) => {}
        }

        let (snapshot, as_update, data) = {
            let aware = aware.lock();
            let tx = aware.doc().transact();
            let snapshot = tx.snapshot();
            let state = tx.encode_state_as_update_v1(&StateVector::default());
            let mut data = String::new();
            read_root_json(&tx).to_json(&mut data);
            (snapshot, state, data)
        };

        let view_ats: Vec<_> = {
            let user_view_ats = user_view_ats.lock();
            user_view_ats
                .iter()
                .map(|(user, value)| (*user, value.clone()))
                .collect()
        };

        save_to_db(&db, map_id, snapshot, as_update, data, view_ats).await?;

        if let Some(res) = done {
            return res;
        }
    }
}

fn process(
    map_id: MapId,
    db: &Db,
    aware: &mut Awareness,
    sockets: &mut Sockets,
    user_view_ats: &mut UserViewAts,
    input: Input,
    output: impl Fn(Output) + Send + 'static,
) -> eyre::Result<()> {
    match input {
        Input::Connect {
            socket: id,
            meta: input,
            fallback_center,
        } => {
            let socket_meta = SocketMeta {
                user: input.user,
                role: input.role,
            };

            if let Some(existing) = sockets.insert(id, socket_meta) {
                return Err(eyre!("socket {id:?} already connected to {existing:?}"));
            }

            let mut enc = EncoderV1::new();
            let sv = aware.doc().transact().state_vector();
            let update = aware.update()?;
            Message::Sync(SyncMessage::SyncStep1(sv)).encode(&mut enc);
            Message::Awareness(update).encode(&mut enc);
            output(Output::Send(id, ByteBuf::from(enc.to_vec())));

            if let Some(user) = input.user {
                if let Some(value) = user_view_ats.get(&user) {
                    output(Output::Send(id, enc_initial_view_at(value)?));
                } else {
                    let db = db.clone();
                    spawn(async move {
                        load_initial_view_at_from_db(db, map_id, user, id, output).await;
                    });
                }
            } else {
                let value = ViewAt {
                    center: fallback_center,
                    zoom: FALLBACK_ZOOM,
                    pitch: 0.0,
                    bearing: 0.0,
                };
                output(Output::Send(id, enc_initial_view_at(&value)?));
            }

            Ok(())
        }
        Input::Recv(id, msg) => {
            let meta = sockets.get_mut(&id).ok_or_else(|| eyre!("not connected"))?;

            if let Err(err) =
                handle_recv(aware, id, meta, user_view_ats, msg.into_vec(), &output)
            {
                output(Output::SocketFatalError(id, format!("handle_msg: {err}")));
            }
            Ok(())
        }
        Input::Leave(id) => {
            if sockets.remove(&id).is_none() {
                let err = "leave: not connected".to_string();
                output(Output::SocketFatalError(id, err));
            }
            Ok(())
        }
    }
}

fn enc_initial_view_at(value: &ViewAt) -> eyre::Result<ByteBuf> {
    let mut enc = EncoderV1::new();
    let value = serde_json::to_vec(&value)?;
    Message::Custom(INITIAL_VIEW_AT_TAG, value).encode(&mut enc);
    Ok(ByteBuf::from(enc.to_vec()))
}

fn handle_recv(
    aware: &mut Awareness,
    id: SocketId,
    meta: &mut SocketMeta,
    user_view_ats: &mut UserViewAts,
    msg: Vec<u8>,
    output: impl Fn(Output),
) -> eyre::Result<()> {
    let mut dec = DecoderV1::from(msg.as_slice());
    let reader = sync::MessageReader::new(&mut dec);
    for msg in reader {
        let msg = match msg {
            Ok(msg) => msg,
            Err(err) => {
                output(Output::SocketFatalError(id, format!("recv decode: {err}")));
                return Ok(());
            }
        };

        match msg {
            Message::Sync(msg) => match msg {
                SyncMessage::SyncStep1(sv) => {
                    let update = aware.doc().transact().encode_state_as_update_v1(&sv);
                    let reply = Message::Sync(SyncMessage::SyncStep2(update));
                    output(Output::Send(id, ByteBuf::from(reply.encode_v1())));
                }
                SyncMessage::SyncStep2(raw) => {
                    if !(meta.role == Role::Editor || meta.role == Role::Owner) {
                        return Err(eyre!("role cannot edit"));
                    }

                    let mut txn = aware.doc().transact_mut();

                    let update = Update::decode_v1(&raw)?;
                    txn.apply_update(update);
                    fix_doc(&mut txn);

                    let update = txn.encode_update_v1();
                    let bcast = Message::Sync(SyncMessage::Update(update));
                    output(Output::Broadcast(ByteBuf::from(bcast.encode_v1())));
                }
                SyncMessage::Update(raw) => {
                    if !(meta.role == Role::Editor || meta.role == Role::Owner) {
                        return Err(eyre!("role cannot edit"));
                    }

                    let mut txn = aware.doc().transact_mut();

                    let update = Update::decode_v1(&raw)?;
                    txn.apply_update(update);
                    fix_doc(&mut txn);

                    let update = txn.encode_update_v1();
                    let bcast = Message::Sync(SyncMessage::Update(update));
                    output(Output::Broadcast(ByteBuf::from(bcast.encode_v1())));
                }
            },
            Message::Auth(reason) => {
                log!("Client unexpectedly told us about our auth: {:?}", reason);
            }
            Message::AwarenessQuery => {
                let update = aware.update()?;
                let reply = Message::Awareness(update);
                output(Output::Send(id, ByteBuf::from(reply.encode_v1())))
            }
            Message::Awareness(update) => {
                let entry = {
                    let mut iter = update.iter();
                    let entry = match iter.next() {
                        Some((_, entry)) => entry,
                        None => return Ok(()),
                    };
                    if iter.next().is_some() {
                        return Err(eyre!("Awareness update with multiple clients"));
                    }
                    entry
                };

                let value = if entry.json == "null" {
                    AwarenessJson::default()
                } else {
                    serde_json::from_str(&entry.json).wrap_err("parse aware json")?
                };

                if let Some(value) = value.viewAt {
                    if let Some(user) = meta.user {
                        user_view_ats.insert(user, value);
                    }
                }

                aware.apply_update(update.clone())?;

                let bcast = Message::Awareness(update);
                output(Output::Broadcast(ByteBuf::from(bcast.encode_v1())));
            }
            Message::Custom(tag, _data) => {
                log!("Client unexpectedly sent custom message with tag {:?}", tag);
            }
        }
    }

    Ok(())
}

fn fix_doc(tx: &mut TransactionMut) {
    let _data = match tx.get_map("data") {
        Some(data) => data,
        None => return,
    };
}

fn create_doc() -> Doc {
    let doc = Doc::new();
    let data = doc.get_or_insert_map("data");
    {
        let mut tx = doc.transact_mut();
        data.insert(&mut tx, "__non_empty", true);
    }
    doc
}

fn read_root_json(tx: &impl ReadTxn) -> YAny {
    tx.get_map("data")
        .map(|s| s.to_json(tx))
        .unwrap_or(lib0::any::Any::Undefined)
}

async fn save_to_db(
    db: &Db,
    map_id: MapId,
    snapshot: Snapshot,
    as_update: Vec<u8>,
    data: String,
    view_ats: Vec<(UserId, ViewAt)>,
) -> eyre::Result<()> {
    // Note: We only have on engine per map so we don't need to worry about concurrent updates

    let mut tx = db.begin().await?;

    let now = Utc::now().naive_utc();

    #[rustfmt::skip]    
    let prev_snapshot = sqlx::query!(r#"
        SELECT snapshot
        FROM map_snapshots
        WHERE (map_id = $1 AND snapshot IS NOT NULL)
        ORDER BY snapshot_at DESC LIMIT 1
    "#, map_id.0).fetch_optional(&mut tx).await?;

    let snapshot_changed = match prev_snapshot {
        None => true,
        Some(prev) => {
            let prev = prev.snapshot;
            let prev = Snapshot::decode_v1(&prev)?;
            prev != snapshot
        }
    };

    if snapshot_changed {
        let snapshot = snapshot.encode_v1();
        let data: serde_json::Value = serde_json::from_str(&data)?;

        #[rustfmt::skip]
        sqlx::query!(r#"
            INSERT INTO map_snapshots (map_id, snapshot, as_update, data, snapshot_at)
            VALUES ($1, $2, $3, $4, $5)
        "#, map_id.0, snapshot, as_update, data, now).execute(&mut tx).await?;
    }

    for (user, value) in view_ats {
        let Center(center_lng, center_lat) = value.center;
        #[rustfmt::skip]
        sqlx::query!(r#"
            INSERT INTO map_view_ats (user_id, map_id, center_lng, center_lat, zoom, pitch, bearing, updated_at, inserted_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            ON CONFLICT (user_id, map_id)
            DO UPDATE SET center_lng = $3, center_lat = $4, zoom = $5, pitch = $6, bearing = $7, updated_at = $8
        "#, user.0, map_id.0, center_lng, center_lat, value.zoom, value.pitch, value.bearing, now, now)
            .execute(&mut tx).await?;
    }

    tx.commit().await?;
    Ok(())
}

async fn load_initial_view_at_from_db(db: Db, map: MapId, user: UserId, socket_id: SocketId, output: impl Fn(Output)) {
    async fn inner(db: Db, map: MapId, user: UserId, socket_id: SocketId, output: impl Fn(Output)) -> eyre::Result<()> {
        let mut db = db.acquire().await?;

        #[rustfmt::skip]
        let value = sqlx::query!(r#"
            SELECT center_lng, center_lat, zoom, pitch, bearing
            FROM map_view_ats
            WHERE map_id = $1 AND user_id = $2
        "#, map.0, user.0).fetch_optional(&mut db).await?;

        let value = match value {
            Some(value) => ViewAt {
                center: Center(value.center_lng, value.center_lat),
                zoom: value.zoom,
                pitch: value.pitch,
                bearing: value.bearing,
            },
            None => return Ok(()),
        };

        output(Output::Send(socket_id, enc_initial_view_at(&value)?));

        Ok(())
    }
    if let Err(e) = inner(db, map, user, socket_id, output).await {
        log!("error in load_initial_view_at_from_db: {:?}", e);
    }
}

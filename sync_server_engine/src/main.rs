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
use sqlx::{Connection, PgConnection};
use tokio::{select, sync::oneshot, time::sleep};
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
    Doc, Map, ReadTxn, StateVector, Transact, TransactionMut, Update, Snapshot,
};

const SAVE_INTERVAL: Duration = Duration::from_secs(10);

// NOTE: We aren't sent users that can't view the document, so we only check edit operations

#[derive(Debug, Deserialize, Serialize, Hash, Eq, PartialEq, Clone, Copy)]
struct SocketId(u32);

#[derive(Debug, Deserialize)]
enum Input {
    Connect(SocketId, InputSocketMeta),
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
    view_at: Option<ViewAt>,
}

#[derive(Debug, Serialize, Deserialize, Clone, Copy, Hash, PartialEq, Eq)]
struct UserId(Uuid);

#[derive(Debug, Deserialize, Copy, Clone, Eq, PartialEq)]
enum Role {
    Viewer,
    Editor,
    Owner,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
struct ViewAt {
    center: (f64, f64),
    zoom: f64,
    pitch: f64,
    bearing: f64,
}

#[allow(non_snake_case)]
#[derive(Debug, Deserialize, Serialize, Clone)]
struct AwarenessJson {
    viewAt: Option<ViewAt>,
    #[serde(flatten)]
    other: HashMap<String, serde_json::Value>,
}

#[derive(Debug, Clone, Copy)]
struct MapId(Uuid);

type Sockets = HashMap<SocketId, SocketMeta>;

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
        mut sender,
        mut receiver,
    } = unsafe {
        use erlang_port::PacketSize;
        erlang_port::nouse_stdio(PacketSize::Four)
    };

    // Note we don't need a connection pool because we only query from the save loop
    let db_url = env::var("DATABASE_URL").wrap_err("DATABASE_URL")?;
    let mut db = PgConnection::connect(&db_url).await?;

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

    let sockets: Arc<parking_lot::Mutex<Sockets>> = Default::default();

    let (tx_close, mut rx_close) = oneshot::channel::<eyre::Result<()>>();

    // Main loop
    let aware2 = aware.clone();
    let sockets2 = sockets.clone();
    tokio::spawn(async move {
        let mut send = |value: Output| sender.send(value);

        // TODO: Add a pr for a failable api for erlang_port so we snapshot if we
        // get an invalid msg instead of just crashing
        for input in receiver.iter::<Input>() {
            let mut aware = aware2.lock();
            let mut sockets = sockets2.lock();
            if let Err(err) = process(&mut aware, &mut sockets, input, &mut send) {
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
            let sockets = sockets.lock();
            sockets
                .iter()
                .filter_map(|(_id, meta)| {
                    let user = meta.user?;
                    let value = meta.view_at.clone()?;
                    Some((user, value))
                })
                .collect()
        };

        save_to_db(&mut db, map_id, snapshot, as_update, data, view_ats).await?;

        if let Some(res) = done {
            return res;
        }
    }
}

fn process(
    aware: &mut Awareness,
    sockets: &mut Sockets,
    input: Input,
    mut output: impl FnMut(Output),
) -> eyre::Result<()> {
    match input {
        Input::Connect(id, input) => {
            let socket_meta = SocketMeta {
                user: input.user,
                role: input.role,
                view_at: None,
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

            Ok(())
        }
        Input::Recv(id, msg) => {
            let meta = sockets.get_mut(&id).ok_or_else(|| eyre!("not connected"))?;
            if let Err(err) = handle_recv(aware, id, meta, msg.into_vec(), &mut output) {
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

fn handle_recv(
    aware: &mut Awareness,
    id: SocketId,
    meta: &mut SocketMeta,
    msg: Vec<u8>,
    mut output: impl FnMut(Output),
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
                {
                    let mut entries = update.iter();

                    if let Some((_, entry)) = entries.next() {
                        if entry.json == "null" {
                            return Ok(());
                        }

                        let value: AwarenessJson = match serde_json::from_str(&entry.json) {
                            Ok(value) => value,
                            Err(err) => {
                                log!("Failed to parse awareness json: {}: {}", &err, &entry.json);
                                return Ok(());
                            }
                        };

                        if let Some(view_at) = value.viewAt {
                            meta.view_at = Some(view_at);
                        }
                    }

                    if entries.next().is_some() {
                        return Err(eyre!("Awareness update with multiple clients"));
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
    db: &mut PgConnection,
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
            let prev = prev.snapshot.expect("snapshot IS NOT NULL");
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
        let (center_lng, center_lat) = value.center;
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

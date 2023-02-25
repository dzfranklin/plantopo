use std::{
    collections::HashMap,
    time::{SystemTime, UNIX_EPOCH},
};

#[allow(unused)]
use eyre::{eyre, WrapErr};

use erlang_port::{IOPort, PortReceive, PortSend};
use lib0::any::Any as YAny;
use serde::{Deserialize, Serialize};
use serde_bytes::ByteBuf;
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
    Doc, Map, ReadTxn, StateVector, Transact, Update, WriteTxn,
};

// NOTE: We aren't sent users that can't view the document, so we only check edit operations

#[derive(Debug, Deserialize, Serialize, Hash, Eq, PartialEq, Clone, Copy)]
struct SocketId(u32);

#[derive(Debug, Deserialize)]
enum Input {
    #[serde(with = "serde_bytes")]
    Init(Option<Vec<u8>>),
    ReqSnapshotsIfChanged,
    Connect(SocketId, InputSocketMeta),
    Recv(SocketId, ByteBuf),
    Leave(SocketId),
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "snake_case")]
enum Output {
    Send(SocketId, ByteBuf),
    Broadcast(ByteBuf),
    MapSnapshot(Snapshot),
    MetaSnapshot(HashMap<UserId, ViewAt>),
    SocketFatalError(SocketId, String),
    FatalError(String, Option<Snapshot>),
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "snake_case")]
struct Snapshot {
    state: ByteBuf,
    data: String,
    snapshot_at: u64,
    after_error: Option<String>,
}

#[derive(Debug, Deserialize)]
struct InputSocketMeta {
    user: Option<UserId>,
    role: Role,
}

#[derive(Debug)]
struct SocketMeta {
    user: Option<UserId>,
    role: Role,
    view_at: Option<ViewAt>,
}

#[derive(Debug, Serialize, Deserialize, Clone, Hash, PartialEq, Eq)]
struct UserId(Uuid);

#[derive(Debug, Deserialize, Copy, Clone, Eq, PartialEq)]
enum Role {
    Viewer,
    Editor,
    Owner,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
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

type Sockets = HashMap<SocketId, SocketMeta>;

macro_rules! log {
    ($fmt:literal) => {
        log!($fmt,)
    };
    ($fmt:literal,$($arg:tt)*) => {
        eprint!(concat!("[sync_server_engine]: ", $fmt, "\r\n"), $($arg)*)
    };
}

fn main() -> eyre::Result<()> {
    let IOPort {
        mut sender,
        mut receiver,
    } = unsafe {
        use erlang_port::PacketSize;
        erlang_port::nouse_stdio(PacketSize::Four)
    };

    let mut aware = None;
    let mut sockets: Sockets = HashMap::new();
    let mut doc_changed_since_snapshot = false;
    let mut views_at_changed_since_snapshot = false;

    // TODO: Add a pr for a failable api for erlang_port so we snapshot if we
    // get an invalid msg instead of just crashing

    for input in receiver.iter::<Input>() {
        if let Err(fatal_err) = process(
            &mut aware,
            &mut sockets,
            &mut doc_changed_since_snapshot,
            &mut views_at_changed_since_snapshot,
            input,
            |output| sender.send(output),
        ) {
            let msg = fatal_err.to_string();
            let snapshot = aware
                .as_ref()
                .map(|aware| make_doc_snapshot(aware.doc(), Some(msg.clone())));
            sender.send(Output::FatalError(msg, snapshot));
            return Err(fatal_err);
        }
    }

    Ok(())
}

fn process(
    aware: &mut Option<Awareness>,
    sockets: &mut Sockets,
    doc_changed_since_snapshot: &mut bool,
    views_at_changed_since_snapshot: &mut bool,
    input: Input,
    mut output: impl FnMut(Output),
) -> eyre::Result<()> {
    match input {
        Input::Init(state) => {
            if aware.is_some() {
                return Err(eyre!("already initialized"));
            }
            let doc = create_doc();

            if let Some(state) = state {
                let state = Update::decode_v1(&state)?;
                let mut tx = doc.transact_mut();
                tx.apply_update(state);
            }

            *aware = Some(Awareness::new(doc));
            Ok(())
        }
        Input::ReqSnapshotsIfChanged => {
            let aware = aware.as_ref().ok_or_else(|| eyre!("not initialized"))?;
            if *doc_changed_since_snapshot {
                let snapshot = make_doc_snapshot(aware.doc(), None);
                output(Output::MapSnapshot(snapshot));
                *doc_changed_since_snapshot = false;
            }
            if *views_at_changed_since_snapshot {
                let snapshot = make_views_at_snapshot(sockets);
                output(Output::MetaSnapshot(snapshot));
                *views_at_changed_since_snapshot = false;
            }
            Ok(())
        }
        Input::Connect(id, input) => {
            let socket_meta = SocketMeta {
                user: input.user,
                role: input.role,
                view_at: None,
            };

            if let Some(existing) = sockets.insert(id, socket_meta) {
                return Err(eyre!("socket {id:?} already connected to {existing:?}"));
            }
            let aware = aware.as_mut().ok_or_else(|| eyre!("not initialized"))?;

            let mut enc = EncoderV1::new();
            let sv = aware.doc().transact().state_vector();
            let update = aware.update()?;
            Message::Sync(SyncMessage::SyncStep1(sv)).encode(&mut enc);
            Message::Awareness(update).encode(&mut enc);

            output(Output::Send(id, ByteBuf::from(enc.to_vec())));

            Ok(())
        }
        Input::Recv(id, msg) => {
            let aware = aware.as_mut().ok_or_else(|| eyre!("not initialized"))?;
            let meta = sockets.get_mut(&id).ok_or_else(|| eyre!("not connected"))?;
            if let Err(err) = handle_recv(
                aware,
                doc_changed_since_snapshot,
                views_at_changed_since_snapshot,
                id,
                meta,
                msg.into_vec(),
                &mut output,
            ) {
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
    doc_changed_since_snapshot: &mut bool,
    views_at_changed_since_snapshot: &mut bool,
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
                    *doc_changed_since_snapshot = true;
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
                    *doc_changed_since_snapshot = true;
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

                *views_at_changed_since_snapshot = true;
            }
            Message::Custom(tag, _data) => {
                log!("Client unexpectedly sent custom message with tag {:?}", tag);
            }
        }
    }

    Ok(())
}

fn fix_doc(_tx: &mut impl WriteTxn) {
    // TODO:
}

fn make_doc_snapshot(doc: &Doc, after_error: Option<String>) -> Snapshot {
    let tx = doc.transact();
    let state = tx.encode_state_as_update_v1(&StateVector::default());
    let state = ByteBuf::from(state);

    let mut data = String::new();
    read_root_json(&tx).to_json(&mut data);

    let snapshot_at = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_secs();

    Snapshot {
        state,
        data,
        snapshot_at,
        after_error,
    }
}

fn make_views_at_snapshot(sockets: &Sockets) -> HashMap<UserId, ViewAt> {
    let mut views_at = HashMap::new();
    for (_, meta) in sockets.iter() {
        if let (Some(user), Some(view_at)) = (meta.user.as_ref(), meta.view_at.as_ref()) {
            views_at.insert(user.clone(), view_at.clone());
        }
    }
    views_at
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

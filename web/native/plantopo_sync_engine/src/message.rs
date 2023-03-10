use lib0::encoding::Write;
use rustler::{Binary, Encoder as _, Env, NifTaggedEnum, OwnedBinary, ResourceArc, Term};
use y_sync::sync::{
    self, MSG_AUTH, MSG_AWARENESS, MSG_QUERY_AWARENESS, MSG_SYNC, MSG_SYNC_STEP_1, MSG_SYNC_STEP_2,
    MSG_SYNC_UPDATE, PERMISSION_DENIED, PERMISSION_GRANTED,
};
use yrs::updates::{
    decoder::DecoderV1,
    encoder::{Encode, Encoder as _, EncoderV1},
};

use crate::{AwarenessUpdate, EmptyResult, Lock, Result, StateVector};

#[derive(NifTaggedEnum)]
pub enum Message<'a> {
    SyncStep1(ResourceArc<StateVector>),
    SyncStep2(Binary<'a>),
    SyncUpdate(Binary<'a>),
    Auth(Option<String>),
    AwarenessQuery(()), // () is so that Message always encodes to tuple
    AwarenessUpdate(ResourceArc<AwarenessUpdate>),
    Custom(u8, Binary<'a>),
}

#[rustler::nif]
pub fn message_decode<'a>(env: Env<'a>, data: Binary) -> Result<Term<'a>> {
    let mut out = Term::list_new_empty(env);

    let mut dec = DecoderV1::from(data.as_slice());
    let reader = sync::MessageReader::new(&mut dec);
    for msg in reader {
        let msg = match msg.map_err(|e| err!(decode, e))? {
            sync::Message::Sync(msg) => match msg {
                sync::SyncMessage::SyncStep1(sv) => Message::SyncStep1(StateVector::new(sv)),
                sync::SyncMessage::SyncStep2(update) => {
                    let mut out = OwnedBinary::new(update.len()).expect("alloc failed");
                    out.copy_from_slice(&update);
                    Message::SyncStep2(Binary::from_owned(out, env))
                }
                sync::SyncMessage::Update(update) => {
                    let mut out = OwnedBinary::new(update.len()).expect("alloc failed");
                    out.copy_from_slice(&update);
                    Message::SyncUpdate(Binary::from_owned(out, env))
                }
            },
            sync::Message::Auth(reason) => Message::Auth(reason),
            sync::Message::AwarenessQuery => Message::AwarenessQuery(()),
            sync::Message::Awareness(update) => {
                Message::AwarenessUpdate(AwarenessUpdate::new(update))
            }
            sync::Message::Custom(tag, data) => {
                let mut out = OwnedBinary::new(data.len()).expect("alloc failed");
                out.copy_from_slice(&data);
                Message::Custom(tag, Binary::from_owned(out, env))
            }
        };
        let msg = msg.encode(env);
        out = out.list_prepend(msg);
    }

    Ok!(out.list_reverse().expect("is list"))
}

pub struct MessageEncoder(pub(crate) Lock<Option<EncoderV1>>);

#[rustler::nif]
pub fn message_encode<'a>(env: Env<'a>, value: Message) -> Result<Binary<'a>> {
    let mut enc = _new();
    _encode(&mut enc, value);
    _finish(env, enc)
}

#[rustler::nif]
pub fn message_encoder_new() -> ResourceArc<MessageEncoder> {
    ResourceArc::new(MessageEncoder(Lock::new(Some(_new()))))
}

pub(crate) fn _new() -> EncoderV1 {
    EncoderV1::new()
}

#[rustler::nif]
pub fn message_encoder_write(enc: ResourceArc<MessageEncoder>, value: Message) -> EmptyResult {
    let mut lock = enc.0.try_lock()?;
    let enc = lock.as_mut().ok_or_else(|| err!(finished))?;
    _encode(enc, value);
    Ok!()
}

pub(crate) fn _encode(enc: &mut EncoderV1, value: Message) {
    match value {
        Message::SyncStep1(sv) => {
            enc.write_var(MSG_SYNC);
            enc.write_var(MSG_SYNC_STEP_1);
            enc.write_buf(sv.0.encode_v1());
        }
        Message::SyncStep2(update) => {
            enc.write_var(MSG_SYNC);
            enc.write_var(MSG_SYNC_STEP_2);
            enc.write_buf(update.as_slice());
        }
        Message::SyncUpdate(update) => {
            enc.write_var(MSG_SYNC);
            enc.write_var(MSG_SYNC_UPDATE);
            enc.write_buf(update.as_slice());
        }
        Message::Auth(reason) => {
            enc.write_var(MSG_AUTH);
            if let Some(reason) = reason {
                enc.write_var(PERMISSION_DENIED);
                enc.write_string(&reason);
            } else {
                enc.write_var(PERMISSION_GRANTED);
            }
        }
        Message::AwarenessQuery(()) => {
            enc.write_var(MSG_QUERY_AWARENESS);
        }
        Message::AwarenessUpdate(update) => {
            enc.write_var(MSG_AWARENESS);
            enc.write_buf(&update.0.encode_v1());
        }
        Message::Custom(tag, data) => {
            enc.write_u8(tag);
            enc.write_buf(data.as_slice());
        }
    }
}

#[rustler::nif]
pub fn message_encoder_finish(env: Env, enc: ResourceArc<MessageEncoder>) -> Result<Binary> {
    let enc = enc.0.try_lock()?.take().ok_or_else(|| err!(finished))?;
    _finish(env, enc)
}

pub(crate) fn _finish(env: Env, enc: EncoderV1) -> Result<Binary> {
    let value = enc.to_vec();
    let mut out = OwnedBinary::new(value.len()).expect("alloc failed");
    out.copy_from_slice(&value);
    Ok!(Binary::from_owned(out, env))
}

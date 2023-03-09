use lib0::encoding::Write;
use rustler::{Binary, Env, OwnedBinary, ResourceArc};
use y_sync::{
    awareness::Awareness as YAwareness,
    sync::{MSG_AWARENESS, MSG_SYNC, MSG_SYNC_STEP_1},
};
use yrs::{
    types::ToJson,
    updates::{decoder::Decode, encoder::Encode as _},
    Doc, Map, ReadTxn, Snapshot, StateVector as YStateVector, Transact, Update,
};

use crate::{AwarenessUpdate, EmptyResult, Lock, MessageEncoder, Result, StateVector};

pub struct Awareness(Lock<YAwareness>);

type AwareRef = ResourceArc<Awareness>;

const NON_EMPTY: &str = "__non_empty";
#[rustler::nif]
pub fn awareness_new() -> AwareRef {
    let doc = Doc::new();
    let data = doc.get_or_insert_map("data");
    {
        let mut tx = doc.transact_mut();

        if !data.contains_key(&tx, NON_EMPTY) {
            data.insert(&mut tx, NON_EMPTY, true);
        }
    }
    let inner = YAwareness::new(doc);
    ResourceArc::new(Awareness(Lock::new(inner)))
}

#[rustler::nif]
pub fn encode_awareness_update(env: Env, aware: AwareRef) -> Result<Binary> {
    let update = aware.0.try_lock()?.update().map_err(|e| err!(encode, e))?;
    let vec = update.encode_v1();
    let mut out = OwnedBinary::new(vec.len()).expect("alloc failed");
    out.copy_from_slice(&vec);
    Ok!(Binary::from_owned(out, env))
}

#[rustler::nif]
pub fn apply_update(aware: AwareRef, update: Binary) -> EmptyResult {
    let update = Update::decode_v1(update.as_slice()).map_err(|e| err!(decode, e))?;
    aware
        .0
        .try_lock()?
        .doc_mut()
        .transact_mut()
        .apply_update(update);
    Ok!()
}

#[rustler::nif]
fn apply_awareness_update(aware: AwareRef, update: ResourceArc<AwarenessUpdate>) -> EmptyResult {
    aware
        .0
        .try_lock()?
        .apply_update(update.0.clone())
        .map_err(|e| err!(decode, e))?;
    Ok!()
}

#[rustler::nif]
pub fn serialize_snapshot_if_changed<'a>(
    env: Env<'a>,
    aware: AwareRef,
    old: Option<Binary>,
) -> Result<Option<Binary<'a>>> {
    let old = match old {
        Some(old) => Snapshot::decode_v1(old.as_slice()).map_err(|e| err!(decode, e))?,
        None => Snapshot::default(),
    };

    let current = aware.0.try_lock()?.doc().transact().snapshot();

    if current == old {
        Ok!(None)
    } else {
        let value = current.encode_v1();
        let mut out = OwnedBinary::new(value.len()).expect("alloc failed");
        out.copy_from_slice(&value);
        Ok!(Some(Binary::from_owned(out, env)))
    }
}

#[rustler::nif]
pub fn serialize_data(aware: AwareRef) -> Result<String> {
    let lock = aware.0.try_lock()?;
    let tx = lock.doc().transact();
    let data = tx.get_map("data").ok_or_else(|| err!(no_data))?;

    let mut value = String::new();
    data.to_json(&tx).to_json(&mut value);
    Ok!(value)
}

#[rustler::nif]
pub fn encode_state_as_update(
    env: Env,
    aware: AwareRef,
    sv: Option<ResourceArc<StateVector>>,
) -> Result<Binary> {
    let lock = aware.0.try_lock()?;
    let blank = YStateVector::default();
    let sv = sv.as_ref().map(|sv| &sv.0).unwrap_or(&blank);
    let update = lock.doc().transact().encode_state_as_update_v1(sv);

    let mut out = OwnedBinary::new(update.len()).expect("alloc failed");
    out.copy_from_slice(&update);
    Ok!(Binary::from_owned(out, env))
}

#[rustler::nif]
pub fn encode_intro(aware: AwareRef, enc: ResourceArc<MessageEncoder>) -> EmptyResult {
    let mut lock = enc.0.try_lock()?;
    let enc = lock.as_mut().ok_or_else(|| err!(finished))?;

    let sv = aware.0.try_lock()?.doc().transact().state_vector();
    let update = aware.0.try_lock()?.update().map_err(|e| err!(decode, e))?;

    enc.write_var(MSG_SYNC);
    enc.write_var(MSG_SYNC_STEP_1);
    enc.write_buf(sv.encode_v1());

    enc.write_var(MSG_AWARENESS);
    enc.write_buf(update.encode_v1());
    Ok!()
}

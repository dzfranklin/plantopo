use rustler::{Env, ResourceArc, Term};
use y_sync::awareness::{AwarenessUpdate as YAwarenessUpdate, AwarenessUpdateEntry};

use crate::Result;

pub struct AwarenessUpdate(pub(crate) YAwarenessUpdate);

impl AwarenessUpdate {
    pub fn new(inner: YAwarenessUpdate) -> ResourceArc<Self> {
        ResourceArc::new(Self(inner))
    }
}

#[rustler::nif]
pub fn awareness_update_to_map(env: Env, value: ResourceArc<AwarenessUpdate>) -> Result<Term> {
    let pairs = value
        .0
        .clients
        .iter()
        .map(|(client_id, AwarenessUpdateEntry { clock, json })| (client_id, (clock, json)))
        .collect::<Vec<_>>();
    let value = Term::map_from_pairs(env, &pairs).map_err(|e| err!(decode, ?e))?;
    Ok!(value)
}

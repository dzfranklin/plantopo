#![feature(const_trait_impl, let_chains, error_in_core, const_option)]
#![cfg_attr(not(any(test, feature = "std")), no_std)]
#![allow(clippy::new_without_default)]

extern crate alloc;

macro_rules! capnp_files {
    ($($name:ident),*,) => {
        $(
            #[allow(unused)]
            pub mod $name {
                include!(concat!(env!("OUT_DIR"), "/", stringify!($name), ".rs"));
            }
        )*
    };
}
capnp_files!(
    delta_capnp,
    sync_capnp,
    save_capnp,
    types_capnp,
    aware_capnp,
);

pub mod attr;
pub mod aware;
pub mod feature;
pub mod layer;

mod capnp_support;
mod client;
mod client_id;
mod delta;
mod error;
mod frac_idx;
mod instant;
mod l_clock;
mod l_instant;
mod lww_reg;
mod map_id;
mod prelude;
mod user_id;

pub use crate::{
    aware::Aware, client::Client, client_id::ClientId, delta::Delta, error::Error, l_clock::LClock,
    l_instant::LInstant, map_id::MapId, user_id::UserId,
};

pub type Result<T> = core::result::Result<T, Error>;

pub use smallvec::SmallVec;
pub use smol_str::SmolStr;
pub use uuid::Uuid;

pub fn read_delta_ts(r: delta_capnp::delta::Reader) -> Result<LInstant> {
    if r.has_ts() {
        let ts = r.get_ts()?;
        Ok(capnp_support::read_l_instant(ts))
    } else {
        Err("Delta missing ts".into())
    }
}

pub fn write_confirm_delta(b: sync_capnp::message::Builder, delta_ts: LInstant) {
    let b = b.init_confirm_delta();
    capnp_support::write_l_instant(b.init_delta_ts(), delta_ts);
}

pub fn read_confirm_delta(r: sync_capnp::confirm_delta::Reader) -> Result<LInstant> {
    if r.has_delta_ts() {
        let ts = r.get_delta_ts()?;
        Ok(capnp_support::read_l_instant(ts))
    } else {
        Err("ConfirmDelta missing delta_ts".into())
    }
}

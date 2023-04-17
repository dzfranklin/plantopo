#![feature(const_trait_impl, let_chains, error_in_core)]
#![cfg_attr(not(any(test, feature = "std")), no_std)]
#![allow(clippy::new_without_default)]

extern crate alloc;

macro_rules! capnp_files {
    ($($name:ident),*) => {
        $(
            #[allow(unused)]
            pub mod $name {
                include!(concat!(env!("OUT_DIR"), "/", stringify!($name), ".rs"));
            }
        )*
    };
}
capnp_files!(delta_capnp, sync_capnp, save_capnp, types_capnp);

pub mod attr;
pub mod feature;
pub mod layer;

mod capnp_support;
mod client;
mod client_id;
mod error;
mod frac_idx;
mod l_clock;
mod l_instant;
mod lww_reg;
mod map_id;
mod prelude;

pub use attr::Value;
pub use client::Client;
pub use client_id::ClientId;
pub use error::Error;
pub use l_clock::LClock;
pub use l_instant::LInstant;
pub use map_id::MapId;

pub type Result<T> = core::result::Result<T, Error>;

pub use smallvec::SmallVec;
pub use smol_str::SmolStr;
pub use uuid::Uuid;

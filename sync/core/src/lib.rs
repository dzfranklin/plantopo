#![feature(const_trait_impl, let_chains)]
#![cfg_attr(not(any(test, feature = "std")), no_std)]
#![allow(clippy::new_without_default)]

extern crate alloc;

mod any_id;
mod attr;
mod client;
mod client_id;
pub mod feature;
mod frac_idx;
mod g_map;
mod l_instant;
pub mod layer;
mod lww_reg;
mod merge;
pub mod op;
mod prelude;
mod subscriber_registry;
mod sync_proto;
mod tp_map;
mod v_clock;

pub type Result<T> = core::result::Result<T, &'static str>;
pub use any_id::AnyId;
pub use attr::AttrValue;
pub use client::{AttrIter, Client, FeatureOrderIter, LayerOrderIter};
pub use client_id::ClientId;
pub use l_instant::LInstant;
pub use merge::Merge;
pub use op::Op;
pub use sync_proto::SyncProto;
pub use v_clock::VClock;

pub use smallvec::SmallVec;
pub use smol_str::SmolStr;
pub use uuid::Uuid;

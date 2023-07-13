pub mod prelude {
    pub use crate::*;
}

mod core;
pub mod frac_idx;
mod l_clock;

pub use crate::{core::*, l_clock::LClock};

pub mod core_capnp {
    include!(concat!(env!("OUT_DIR"), "/core_capnp.rs"));
}

pub mod map_capnp {
    include!(concat!(env!("OUT_DIR"), "/map_capnp.rs"));
}

pub mod style_capnp {
    include!(concat!(env!("OUT_DIR"), "/style_capnp.rs"));
}

pub mod sync_capnp {
    include!(concat!(env!("OUT_DIR"), "/sync_capnp.rs"));
}

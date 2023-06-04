#![allow(non_snake_case)]

mod client;
mod error;

pub(crate) use plantopo_sync_core as sync_core;

use wasm_bindgen::prelude::*;

#[wasm_bindgen(start)]
pub fn start() {
    std::panic::set_hook(Box::new(console_error_panic_hook::hook));
    tracing_wasm::set_as_global_default();
}

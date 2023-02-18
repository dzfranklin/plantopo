#![allow(clippy::new_without_default, non_snake_case)]

use wasm_bindgen::prelude::*;

#[global_allocator]
static ALLOC: wee_alloc::WeeAlloc = wee_alloc::WeeAlloc::INIT;

#[wasm_bindgen]
extern "C" {
    fn alert(s: &str);

    #[wasm_bindgen(js_namespace = console)]
    fn log(s: &str);

    #[wasm_bindgen(js_namespace = console)]
    fn error(s: &str);
}

#[wasm_bindgen(start)]
pub fn web_start() {
    #[cfg(debug)]
    {
        console_error_panic_hook::set_once();
    }
}

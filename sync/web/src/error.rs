use wasm_bindgen::{JsError, JsValue};

use crate::sync_core;

#[derive(Debug)]
pub struct Error(Inner);

impl Error {
    // Presumes `e` is a `JsValue` that is an `Error` object.
    pub fn from_js(e: JsValue) -> Self {
        Self(Inner::JsError(e))
    }
}

#[derive(Debug)]
enum Inner {
    String(String),
    JsError(JsValue),
}

impl From<&'_ str> for Error {
    fn from(s: &str) -> Self {
        Self(Inner::String(s.to_string()))
    }
}

impl From<capnp::Error> for Error {
    fn from(e: capnp::Error) -> Self {
        Self(Inner::String(format!("capnp error: {}", e)))
    }
}

impl From<sync_core::Error> for Error {
    fn from(e: sync_core::Error) -> Self {
        Self(Inner::String(e.to_string()))
    }
}

impl From<Error> for JsValue {
    fn from(e: Error) -> Self {
        match e.0 {
            Inner::String(s) => JsValue::from(JsError::new(&s)),
            Inner::JsError(e) => e,
        }
    }
}

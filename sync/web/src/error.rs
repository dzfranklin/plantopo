use wasm_bindgen::{JsCast, JsError, JsValue};

use crate::sync_core;

#[derive(Debug)]
pub struct Error(Inner);

#[derive(Debug)]
enum Inner {
    Static(&'static str),
    String(String),
    JsError(JsValue),
}

impl From<&'static str> for Error {
    fn from(s: &'static str) -> Self {
        Self(Inner::Static(s))
    }
}

impl From<String> for Error {
    fn from(s: String) -> Self {
        Self(Inner::String(s))
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

impl From<JsValue> for Error {
    fn from(e: JsValue) -> Self {
        if js_sys::Error::instanceof(&e) {
            Self(Inner::JsError(e))
        } else {
            Self(Inner::String(format!("{e:?}")))
        }
    }
}

impl From<Error> for JsValue {
    fn from(e: Error) -> Self {
        match e.0 {
            Inner::Static(s) => JsValue::from(JsError::new(s)),
            Inner::String(s) => JsValue::from(JsError::new(&s)),
            Inner::JsError(e) => e,
        }
    }
}

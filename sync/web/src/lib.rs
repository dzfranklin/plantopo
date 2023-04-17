#![allow(non_snake_case)]

mod error;

use error::Error;

use std::{io::Write, str::FromStr};

use capnp::{message::Builder, serialize_packed};
use js_sys::{Array, JsString, Object, Reflect};
use plantopo_sync_core as sync_core;
use rand_chacha::ChaCha20Rng;
use rand_core::SeedableRng;
use sync_core::{attr, delta_capnp, feature, layer, ClientId, LInstant, MapId, SmallVec, Uuid};
use wasm_bindgen::{intern, prelude::*};

pub type Result<T> = std::result::Result<T, Error>;

#[wasm_bindgen(start)]
pub fn start() {
    tracing_wasm::set_as_global_default();
}

#[wasm_bindgen]
pub struct Client {
    inner: sync_core::Client,
    cp_alloc: capnp::message::HeapAllocator,
    last_delta: Option<Vec<u8>>,
}

#[wasm_bindgen]
impl Client {
    #[wasm_bindgen(constructor)]
    pub fn constructor(map_id: &str, client_id: u64) -> Result<Client> {
        let map_id = MapId::from_str(map_id).map_err(|_| "parse map_id from uuid str")?;
        let client_id = ClientId(client_id);
        let rng = ChaCha20Rng::from_entropy();
        let inner = sync_core::Client::new(client_id, map_id, rng);

        Ok(Self {
            inner,
            cp_alloc: capnp::message::HeapAllocator::default(),
            last_delta: None,
        })
    }

    #[wasm_bindgen]
    pub fn merge(&mut self, delta: &[u8]) -> Result<()> {
        let opts = capnp::message::ReaderOptions::default();
        let segments = capnp::serialize::BufferSegments::new(delta, opts)?;
        let reader = capnp::message::Reader::new(segments, opts);
        let root = reader.get_root::<delta_capnp::delta::Reader>()?;

        self.inner.merge(root)?;

        Ok(())
    }

    #[wasm_bindgen]
    pub fn lastDelta(&mut self) -> Option<Box<[u8]>> {
        self.last_delta.take().map(|v| v.into_boxed_slice())
    }

    #[wasm_bindgen]
    pub fn layerOrder(&self) -> Array {
        let out = Array::new();
        for id in self.inner.layer_order() {
            let id = layer_to_js(id);
            out.push(&id);
        }
        out
    }

    #[wasm_bindgen]
    pub fn layerAttrs(&mut self, layer: &str) -> Result<Option<Object>> {
        let layer = layer_from_js(layer)?;
        let Some(attrs) = self.inner.layer_attrs(&layer) else { return Ok(None); };

        let obj = Object::new();
        for (k, v) in attrs {
            let k: u16 = k.into();
            let v = attr_to_js(v);
            Reflect::set_u32(&obj, k as u32, &v).map_err(Error::from_js)?;
        }

        Ok(Some(obj))
    }

    #[wasm_bindgen]
    pub fn setLayerAttr(&mut self, layer: &str, key: u16, value: JsValue) -> Result<()> {
        let layer = layer_from_js(layer)?;
        let key = attr::Key::from(key);
        let value = attr_from_js(value)?;

        let mut b = Builder::new(&mut self.cp_alloc);
        self.inner
            .set_layer_attr(b.init_root(), layer, key, value)?;

        let mut out = Vec::with_capacity(64);
        serialize_packed::write_message(&mut out, &b).unwrap();
        self.last_delta = Some(out);

        Ok(())
    }

    #[wasm_bindgen]
    pub fn moveLayer(
        &mut self,
        layer: &str,
        before: Option<String>,
        after: Option<String>,
    ) -> Result<()> {
        let layer = layer_from_js(layer)?;
        let before = before.as_deref().map(layer_from_js).transpose()?;
        let after = after.as_deref().map(layer_from_js).transpose()?;

        let mut b = Builder::new(&mut self.cp_alloc);
        self.inner.move_layer(b.init_root(), layer, before, after)?;

        let mut out = Vec::with_capacity(64);
        serialize_packed::write_message(&mut out, &b).unwrap();
        self.last_delta = Some(out);

        Ok(())
    }

    #[wasm_bindgen]
    pub fn removeLayer(&mut self, layer: &str) -> Result<()> {
        let layer = layer_from_js(layer)?;

        let mut b = Builder::new(&mut self.cp_alloc);
        self.inner.remove_layer(b.init_root(), layer)?;

        let mut out = Vec::with_capacity(64);
        serialize_packed::write_message(&mut out, &b).unwrap();
        self.last_delta = Some(out);

        Ok(())
    }

    #[wasm_bindgen]
    pub fn featureOrder(&self, parent: &str) -> Result<Option<Array>> {
        let parent = feature_from_js(parent)?;

        let Some(order) = self.inner.feature_order(parent) else { return Ok(None); };

        let out = Array::new();
        for id in order {
            let id = feature_to_js(id);
            out.push(&id);
        }
        Ok(Some(out))
    }

    #[wasm_bindgen]
    pub fn featureAttrs(&mut self, feature: &str) -> Result<Option<Object>> {
        let feature = feature_from_js(feature)?;

        let obj = Object::new();

        let Some(ty) = self.inner.feature_ty(feature) else { return Ok(None)};
        Reflect::set(
            &obj,
            &JsValue::from_str(intern("type")),
            &JsValue::from_f64(ty.into_inner() as f64),
        )
        .map_err(Error::from_js)?;

        let Some(attrs) = self.inner.feature_attrs(feature) else { return Ok(None)};
        for (k, v) in attrs {
            let k: u16 = k.into();
            let v = attr_to_js(v);
            Reflect::set_u32(&obj, k as u32, &v).map_err(Error::from_js)?;
        }

        Ok(Some(obj))
    }

    #[wasm_bindgen]
    pub fn createFeature(&mut self, ty: u8) -> Result<JsString> {
        let mut b = Builder::new(&mut self.cp_alloc);
        let id = self.inner.create_feature(b.init_root(), ty.into())?;

        let mut out = Vec::with_capacity(64);
        serialize_packed::write_message(&mut out, &b)?;
        self.last_delta = Some(out);

        Ok(feature_to_js(id))
    }

    #[wasm_bindgen]
    pub fn setFeatureAttr(&mut self, feature: &str, key: u16, value: JsValue) -> Result<()> {
        let feature = feature_from_js(feature)?;
        let key = attr::Key::from(key);
        let value = attr_from_js(value)?;

        let mut b = Builder::new(&mut self.cp_alloc);
        self.inner
            .set_feature_attr(b.init_root(), feature, key, value)?;

        let mut out = Vec::with_capacity(64);
        serialize_packed::write_message(&mut out, &b).unwrap();
        self.last_delta = Some(out);

        Ok(())
    }

    #[wasm_bindgen]
    pub fn moveFeature(
        &mut self,
        feature: &str,
        parent: &str,
        before: Option<String>,
        after: Option<String>,
    ) -> Result<()> {
        let feature = feature_from_js(feature)?;
        let parent = feature_from_js(parent)?;
        let before = before.as_deref().map(feature_from_js).transpose()?;
        let after = after.as_deref().map(feature_from_js).transpose()?;

        let mut b = Builder::new(&mut self.cp_alloc);
        self.inner
            .move_feature(b.init_root(), feature, parent, before, after)?;

        let mut out = Vec::with_capacity(64);
        serialize_packed::write_message(&mut out, &b).unwrap();
        self.last_delta = Some(out);

        Ok(())
    }

    #[wasm_bindgen]
    pub fn deleteFeature(&mut self, feature: &str) -> Result<()> {
        let feature = feature_from_js(feature)?;

        let mut b = Builder::new(&mut self.cp_alloc);
        self.inner.delete_feature(b.init_root(), feature)?;

        let mut out = Vec::with_capacity(64);
        serialize_packed::write_message(&mut out, &b).unwrap();
        self.last_delta = Some(out);

        Ok(())
    }

    #[wasm_bindgen]
    pub fn toString(&self) -> String {
        format!("{:#?}", self.inner)
    }
}

fn feature_from_js(value: &str) -> Result<feature::Id> {
    let value = value.as_bytes();
    if value[0] != b'F' {
        return Err("feature id missing prefix".into());
    }
    let value = &value[1..];

    let sep = value
        .iter()
        .position(|&b| b == b'@')
        .ok_or("missing separator")?;

    let counter = &value[..sep];
    let client = &value[sep + 1..];

    let counter = hex_to_u64(counter)?;
    let client = hex_to_u64(client)?;

    Ok(feature::Id(LInstant::new(client.into(), counter)))
}

fn layer_from_js(value: &str) -> Result<layer::Id> {
    let value = value.as_bytes();
    if value[0] != b'L' {
        return Err("layer id missing prefix".into());
    }
    let value = &value[1..];
    let uuid =
        Uuid::try_parse_ascii(&value).map_err(|_| "failed to parse layer id as ascii uuid")?;
    Ok(layer::Id(uuid))
}

fn feature_to_js(id: feature::Id) -> JsString {
    let mut out = vec![b'F'];
    u64_to_hex(id.0.counter, &mut out);
    out.push(b'@');
    u64_to_hex(id.0.client.into(), &mut out);
    let out: Vec<u16> = out.into_iter().map(|b| b as u16).collect();
    JsString::from_char_code(&out)
}

fn layer_to_js(id: layer::Id) -> JsString {
    let mut out = vec![b'L'];
    let uuid: Uuid = id.into();
    write!(out, "{}", uuid).expect("infallible write");
    let out: Vec<u16> = out.into_iter().map(|b| b as u16).collect();
    JsString::from_char_code(&out)
}

fn hex_to_u64(x: &[u8]) -> Result<u64> {
    let mut result: u64 = 0;
    for i in x {
        result *= 16;
        result += (*i as char).to_digit(16).ok_or("invalid hex digit")? as u64;
    }
    Ok(result)
}

fn u64_to_hex(x: u64, out: &mut Vec<u8>) {
    write!(out, "{:x}", x).expect("infallible write");
}

fn attr_from_js(value: JsValue) -> Result<attr::Value> {
    use attr::Value;
    if value.is_null() || value.is_undefined() {
        Ok(Value::None)
    } else if let Some(value) = value.as_bool() {
        Ok(Value::Bool(value))
    } else if let Some(v) = value.as_string() {
        Ok(Value::String(v.into()))
    } else if let Some(v) = value.as_f64() {
        Ok(Value::number(v))
    } else {
        let mut iter = js_sys::try_iter(&value)
            .map_err(Error::from_js)?
            .ok_or("expected iterable")?;

        let first = iter
            .next()
            .ok_or("expected iterable to not be empty")?
            .map_err(Error::from_js)?;

        if let Some(first) = first.as_f64() {
            let mut out = SmallVec::new();
            out.push(first.into());
            for v in iter {
                let v = v
                    .map_err(Error::from_js)?
                    .as_f64()
                    .ok_or("type of subsequent iterable item must match first: expected number")?;
                out.push(v.into());
            }
            Ok(Value::NumberArray(out))
        } else if let Some(first) = first.as_string() {
            let mut out = SmallVec::new();
            out.push(first.into());
            for v in iter {
                let v = v
                    .map_err(Error::from_js)?
                    .as_string()
                    .ok_or("type of subsequent iterable item must match first: expected string")?;
                out.push(v.into());
            }
            Ok(Value::StringArray(out))
        } else {
            Err("expected iterable of numbers or strings".into())
        }
    }
}

fn attr_to_js(value: &attr::Value) -> JsValue {
    use attr::Value;
    match value {
        Value::None => JsValue::null(),
        Value::Bool(v) => (*v).into(),
        Value::Number(v) => JsValue::from_f64(v.into_inner()),
        Value::NumberArray(v) => {
            let out = Array::new_with_length(v.len() as u32);
            for (i, v) in v.into_iter().enumerate() {
                let v = JsValue::from_f64(v.into_inner());
                out.set(i as u32, v);
            }
            out.into()
        }
        Value::String(v) => JsValue::from_str(v.as_str()),
        Value::StringArray(v) => {
            let out = Array::new_with_length(v.len() as u32);
            for (i, v) in v.into_iter().enumerate() {
                let v = JsValue::from_str(&v);
                out.set(i as u32, v);
            }
            out.into()
        }
        value => {
            tracing::info!(?value, "Unknown attr value, returning null");
            JsValue::null()
        }
    }
}

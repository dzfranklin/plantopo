#![allow(non_snake_case)]

use std::{borrow::Cow, collections::BTreeMap, fmt};

use js_sys::Function;
use plantopo_sync_core as sync_core;
use serde_wasm_bindgen as serde_wasm;
use sync_core::{
    feature, AnyId, AttrIter, AttrValue, ClientId, FeatureOrderIter, LayerOrderIter, SyncProto,
};
use wasm_bindgen::{prelude::*, throw_str};

pub type Result<T> = std::result::Result<T, WebError>;

type LayerOrderSub = Box<dyn Fn(LayerOrderIter<'_>)>;
type FeatureOrderSub = Box<dyn Fn(FeatureOrderIter<'_>)>;
type AttrSub = Box<dyn Fn(AttrIter<'_>)>;
type Client = sync_core::Client<LayerOrderSub, FeatureOrderSub, AttrSub, AttrSub>;

static mut FROM_LOCAL_ID: BTreeMap<u32, AnyId> = BTreeMap::new();
static mut TO_LOCAL_ID: BTreeMap<AnyId, u32> = BTreeMap::new();
static mut CLIENT: Option<Client> = None;

#[wasm_bindgen(start)]
pub fn start() {
    tracing_wasm::set_as_global_default();
}

#[wasm_bindgen]
pub fn setup(id: u32) -> Result<()> {
    let id = ClientId(id);
    unsafe {
        if CLIENT.is_some() {
            // Required so that we can hand out static lifetimes in `client()`
            return Err("client already initialized".into());
        }
        CLIENT = Some(sync_core::Client::new(id));
    }
    Ok(())
}

fn client() -> Result<&'static mut Client> {
    unsafe {
        // Safety: Single-threaded and we never change the client once set
        CLIENT
            .as_mut()
            .ok_or_else(|| "client not initialized".into())
    }
}

#[wasm_bindgen]
pub fn handleRecv(data: &[u8]) -> Result<()> {
    let req = SyncProto::from_bytes(&data)?;
    match req {
        SyncProto::Broadcast(op) => {
            client()?.apply(op);
            Ok(())
        }
        SyncProto::Sync(ops) => {
            let client = client()?;
            for op in ops {
                client.apply(op);
            }
            Ok(())
        }
        SyncProto::Error(err) => Err(format!("received error: {err}").into()),
        _ => Ok(()),
    }
}

#[wasm_bindgen]
pub fn encodeReqSync() -> Result<Vec<u8>> {
    let clock = client()?.clock();
    SyncProto::RequestSync(Cow::Borrowed(clock))
        .to_bytes()
        .map_err(Into::into)
}

#[wasm_bindgen]
pub fn subscribeFeatureOrder(parent: u32, sub: Function) -> Result<u32> {
    let out = js_sys::Array::new();
    let handle = client()?.subscribe_feature_order(
        lid(parent)?.try_into()?,
        Box::new(move |v| {
            out.set_length(0);
            for id in v {
                out.push(&JsValue::from(make_lid(id.into())));
            }
            let _ = sub.call1(&JsValue::NULL, &out);
        }),
    );
    Ok(handle)
}

#[wasm_bindgen]
pub fn unsubscribeFeatureOrder(handle: u32) -> Result<()> {
    client()?.unsubscribe_feature_order(handle);
    Ok(())
}

#[wasm_bindgen]
pub fn featureAttrs(feature: u32) -> Result<JsValue> {
    let v = client()?.feature_attrs(lid(feature)?.try_into()?);
    Ok(serde_wasm::to_value(&v)?)
}

#[wasm_bindgen]
pub fn subscribeFeatureAttrs(feature: u32, sub: Function) -> Result<u32> {
    Ok(client()?.subscribe_feature_attrs(
        lid(feature)?.try_into()?,
        Box::new(move |v| {
            if let Ok(v) = serde_wasm::to_value(&v) {
                let _ = sub.call1(&JsValue::NULL, &v);
            } else {
                throw_str("serialize in subscribe_feature_attrs callback");
            }
        }),
    ))
}

#[wasm_bindgen]
pub fn unsubscribeFeatureAttrs(handle: u32) -> Result<()> {
    client()?.unsubscribe_feature_attrs(handle);
    Ok(())
}

#[wasm_bindgen]
pub fn createFeature(ty: u8) -> Result<JsValue> {
    let (id, op) = client()?.create_feature(feature::Type(ty))?;
    let id = make_lid(id.into());
    let op = op.to_bytes()?;

    let out = js_sys::Object::new();
    js_sys::Reflect::set(&out, &"id".into(), &id.into())?;
    js_sys::Reflect::set(&out, &"op".into(), &serde_wasm::to_value(&op)?)?;
    Ok(out.into())
}

#[wasm_bindgen]
pub fn setFeatureTrashed(id: u32, value: bool) -> Result<Vec<u8>> {
    client()?
        .set_feature_trashed(lid(id)?.try_into()?, value)?
        .to_bytes()
        .map_err(Into::into)
}

#[wasm_bindgen]
pub fn setFeatureAttr(id: u32, key: &str, value: JsValue) -> Result<Vec<u8>> {
    client()?
        .set_feature_attr(lid(id)?.try_into()?, key, to_attr_value(value)?)?
        .to_bytes()
        .map_err(Into::into)
}

#[wasm_bindgen]
pub fn subscribeLayerOrder(sub: Function) -> Result<u32> {
    let out = js_sys::Array::new();
    let handle = client()?.subscribe_layer_order(Box::new(move |v| {
        for id in v {
            out.push(&JsValue::from(make_lid(id.into())));
        }
        let _ = sub.call1(&JsValue::NULL, &out);
    }));
    Ok(handle)
}

#[wasm_bindgen]
pub fn unsubscribeLayerOrder(handle: u32) -> Result<()> {
    client()?.unsubscribe_layer_order(handle);
    Ok(())
}

#[wasm_bindgen]
pub fn subscribeLayerAttrs(layer: u32, sub: Function) -> Result<u32> {
    let handle = client()?.subscribe_layer_attrs(
        lid(layer)?.try_into()?,
        Box::new(move |v| {
            if let Ok(v) = serde_wasm::to_value(&v) {
                let _ = sub.call1(&JsValue::NULL, &v);
            } else {
                throw_str("serialize in subscribe_layer_attrs callback");
            }
        }),
    );
    Ok(handle)
}

#[wasm_bindgen]
pub fn unsubscribeLayerAttrs(handle: u32) -> Result<()> {
    client()?.unsubscribe_layer_attrs(handle);
    Ok(())
}

#[wasm_bindgen]
pub fn layerAttrs(layer: u32) -> Result<JsValue> {
    let v = client()?.layer_attrs(lid(layer)?.try_into()?);
    Ok(serde_wasm::to_value(&v)?)
}

#[wasm_bindgen]
pub fn moveFeature(
    id: u32,
    parent: u32,
    before: Option<u32>,
    after: Option<u32>,
) -> Result<Vec<u8>> {
    let before = if let Some(before) = before {
        let before = lid(before)?.try_into()?;
        Some(before)
    } else {
        None
    };

    let after = if let Some(after) = after {
        let after = lid(after)?.try_into()?;
        Some(after)
    } else {
        None
    };

    client()?
        .move_feature(
            lid(id)?.try_into()?,
            lid(parent)?.try_into()?,
            before,
            after,
        )?
        .to_bytes()
        .map_err(Into::into)
}

#[wasm_bindgen]
pub fn deleteFeature(id: u32) -> Result<Vec<u8>> {
    client()?
        .delete_feature(lid(id)?.try_into()?)?
        .to_bytes()
        .map_err(Into::into)
}

#[wasm_bindgen]
pub fn moveLayer(id: u32, before: Option<u32>, after: Option<u32>) -> Result<Vec<u8>> {
    let before = if let Some(before) = before {
        let before = lid(before)?.try_into()?;
        Some(before)
    } else {
        None
    };

    let after = if let Some(after) = after {
        let after = lid(after)?.try_into()?;
        Some(after)
    } else {
        None
    };

    client()?
        .move_layer(lid(id)?.try_into()?, before, after)?
        .to_bytes()
        .map_err(Into::into)
}

#[wasm_bindgen]
pub fn removeLayer(id: u32) -> Result<Vec<u8>> {
    client()?
        .remove_layer(lid(id)?.try_into()?)?
        .to_bytes()
        .map_err(Into::into)
}

#[wasm_bindgen]
pub fn setLayerAttr(id: u32, key: &str, value: JsValue) -> Result<Vec<u8>> {
    client()?
        .set_layer_attr(lid(id)?.try_into()?, key.into(), to_attr_value(value)?)?
        .to_bytes()
        .map_err(Into::into)
}

#[wasm_bindgen]
pub fn debug() -> Result<String> {
    client().map(|c| format!("{:#?}", c))
}

#[wasm_bindgen]
pub fn debugLocalId(id: u32) -> Result<String> {
    lid(id).map(|id| format!("{:?}", id))
}

#[wasm_bindgen]
pub fn debugIdTables() -> String {
    unsafe {
        // Safety: No concurrency
        format!(
            "TO_LOCAL_ID: {:#?}\nFROM_LOCAL_ID: {:#?}",
            TO_LOCAL_ID, FROM_LOCAL_ID
        )
    }
}

fn lid(id: u32) -> Result<AnyId> {
    if id == 0 {
        Err("0 is never a local id".into())
    } else if id == 1 {
        Ok(AnyId::Feature(feature::Id::ROOT))
    } else {
        unsafe {
            // Safety: No concurrency
            FROM_LOCAL_ID
                .get(&id)
                .copied()
                .ok_or_else(|| "nonexistant local id".into())
        }
    }
}

fn make_lid(rid: AnyId) -> u32 {
    unsafe {
        // Safety: No concurrency

        if let Some(&lid) = TO_LOCAL_ID.get(&rid) {
            lid
        } else {
            // Note: We skip 0 because it's falsy in JS and reserve 1 for the root
            // feature.
            let lid = TO_LOCAL_ID.len() as u32 + 2;

            TO_LOCAL_ID.insert(rid, lid);
            FROM_LOCAL_ID.insert(lid, rid);

            lid
        }
    }
}

fn to_attr_value(value: JsValue) -> Result<AttrValue> {
    if value.is_null() || value.is_undefined() {
        Ok(AttrValue::None)
    } else if let Some(value) = value.as_bool() {
        Ok(AttrValue::Bool(value))
    } else if let Some(v) = value.as_string() {
        Ok(AttrValue::String(v.into()))
    } else if let Some(v) = value.as_f64() {
        Ok(AttrValue::number(v))
    } else if let Ok(v) = serde_wasm::from_value::<Vec<f64>>(value.clone()) {
        Ok(AttrValue::number_array(v.into_iter()))
    } else if let Ok(v) = serde_wasm::from_value::<Vec<String>>(value) {
        let v = v.into_iter().map(|v| v.into()).collect();
        Ok(AttrValue::StringArray(v))
    } else {
        Err("invalid value".into())
    }
}

#[derive(Debug)]
pub enum WebError {
    Static(&'static str),
    Dynamic(JsValue),
}

impl std::error::Error for WebError {}

impl fmt::Display for WebError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::Static(s) => write!(f, "{}", s),
            Self::Dynamic(v) => write!(f, "{:?}", v),
        }
    }
}

impl From<&'static str> for WebError {
    fn from(s: &'static str) -> Self {
        Self::Static(s)
    }
}

impl From<String> for WebError {
    fn from(s: String) -> Self {
        Self::Dynamic(s.into())
    }
}

impl From<JsValue> for WebError {
    fn from(v: JsValue) -> Self {
        Self::Dynamic(v)
    }
}

impl From<serde_wasm_bindgen::Error> for WebError {
    fn from(e: serde_wasm_bindgen::Error) -> Self {
        Self::Dynamic(e.into())
    }
}

impl From<postcard::Error> for WebError {
    fn from(e: postcard::Error) -> Self {
        Self::Dynamic(e.to_string().into())
    }
}

impl From<WebError> for JsValue {
    fn from(e: WebError) -> Self {
        match e {
            WebError::Static(s) => JsValue::from(JsError::new(s)),
            WebError::Dynamic(v) => v,
        }
    }
}

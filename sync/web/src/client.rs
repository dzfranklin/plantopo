use std::{
    collections::{HashMap, HashSet},
    fmt,
    io::Write,
    str::FromStr,
};

use capnp::{message::Builder, serialize_packed};
use js_sys::{Array, JsString, Object, Reflect, Uint8Array};
use rand_chacha::ChaCha20Rng;
use rand_core::SeedableRng;
use sync_core::{Aware, UserId};
use wasm_bindgen::{intern, prelude::*};
use xxhash_rust::xxh3::Xxh3;

use crate::error::Error;
use crate::sync_core::{
    self, attr, feature, layer, read_confirm_delta, read_delta_ts,
    sync_capnp::{self, message},
    ClientId, LInstant, MapId, SmallVec, Uuid,
};

pub type Result<T> = std::result::Result<T, Error>;

mod strings {
    use js_sys::JsString;
    use std::cell::OnceCell;

    struct StaticStr(OnceCell<JsString>);

    impl StaticStr {
        pub const fn new() -> Self {
            Self(OnceCell::new())
        }
    }

    // Safety: We don't use threads
    unsafe impl Sync for StaticStr {}

    macro_rules! define {
        ($($name:ident),* $(,)?) => {
            $(
                pub fn $name() -> &'static JsString {
                    static VALUE: StaticStr = StaticStr::new();
                    VALUE.0.get_or_init(|| JsString::from(stringify!($name)))
                }
            )*
        };
    }

    define! {
        payload, layer, layers, key, value, before, after, feature, features,
        parent, delta, confirmDelta, deltaTs, error, code, description, unknown,
        variant, id, sync, syncTs, attrs, aware, order, my, myId, peers,
        shouldConfirm, linearIdx, ids, user,
    }

    pub fn ty() -> &'static JsString {
        static VALUE: StaticStr = StaticStr::new();
        VALUE.0.get_or_init(|| JsString::from("type"))
    }
}

#[wasm_bindgen]
pub struct Client {
    user_id: Option<UserId>,
    inner: sync_core::Client,
    state_cache: StateCache,
    hasher: Xxh3,
}

impl fmt::Debug for Client {
    fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
        f.debug_struct("Client")
            .field("user_id", &self.user_id)
            .field("inner", &self.inner)
            .field("state_cache", &self.state_cache)
            .finish()
    }
}

#[derive(Debug, Default)]
struct StateCache {
    root: Object,
    layers: Array,
    layer_items: HashMap<layer::Id, Object>,
    features: Object,
    feature_orders: HashMap<feature::Id, FeatureOrderItem>,
    feature_values: HashMap<feature::Id, Object>,
    aware: Object,
    attrs: Object,
}

#[derive(Debug)]
struct FeatureOrderItem {
    hash: u64,
    js: Array,
}

#[wasm_bindgen]
impl Client {
    #[wasm_bindgen(constructor)]
    pub fn constructor(map_id: &str, client_id: u64, user_id: Option<String>) -> Result<Client> {
        let map_id = MapId::from_str(map_id).map_err(|_| "parse map_id from uuid str")?;
        let client_id = ClientId(client_id);
        let user_id = user_id
            .as_deref()
            .map(UserId::from_str)
            .transpose()
            .map_err(|_| "parse user_id from uuid str")?;
        let rng = ChaCha20Rng::from_entropy();
        let inner = sync_core::Client::new(client_id, map_id, rng);

        Ok(Self {
            user_id,
            inner,
            state_cache: Default::default(),
            hasher: Default::default(),
        })
    }

    #[wasm_bindgen]
    pub fn authMsg(&self, token: &str) -> Result<Uint8Array> {
        let mut msg_b = Builder::new_default();
        let mut b = msg_b
            .init_root::<sync_capnp::message::Builder>()
            .init_auth();

        b.set_token(token);

        let mut out = Vec::with_capacity(512);
        serialize_packed::write_message(&mut out, &msg_b).expect("infallible write");
        let out = Uint8Array::from(out.as_slice());

        Ok(out)
    }

    #[wasm_bindgen]
    pub fn recv(&mut self, msg: &[u8]) -> Result<Object> {
        let opts = capnp::message::ReaderOptions::default();
        let reader = capnp::serialize_packed::read_message(msg, opts)?;
        let root = reader.get_root::<sync_capnp::message::Reader>()?;

        let out = Object::new();

        use sync_capnp::message::Which;
        match root.which() {
            Ok(Which::Delta(delta)) => {
                let delta = delta?;
                let ts = l_instant_to_str(None, read_delta_ts(delta)?);
                self.inner.merge(delta)?;

                Reflect::set(&out, strings::ty(), strings::delta())?;
                Reflect::set(&out, strings::deltaTs(), &ts.into())?;
            }
            Ok(Which::ConfirmDelta(conf)) => {
                let conf = conf?;
                let ts = l_instant_to_str(None, read_confirm_delta(conf)?);

                Reflect::set(&out, strings::ty(), strings::confirmDelta())?;
                Reflect::set(&out, strings::deltaTs(), &ts.into())?;
            }
            Ok(Which::Aware(aware)) => {
                let aware = aware?;
                self.inner.merge_aware(aware)?;

                Reflect::set(&out, strings::ty(), strings::aware())?;
            }
            Ok(Which::Error(err)) => {
                let err = err?;
                let code = err.get_code();
                let desc = err.get_description()?;

                Reflect::set(&out, strings::ty(), strings::error())?;
                Reflect::set(&out, strings::code(), &code.into())?;
                Reflect::set(&out, strings::description(), &desc.into())?;
            }
            Ok(Which::Auth(_)) => {
                return Err("unexpected auth message".into());
            }
            Err(err) => {
                Reflect::set(&out, strings::ty(), strings::unknown())?;
                Reflect::set(&out, strings::variant(), &err.0.into())?;
            }
        }

        Ok(out)
    }

    #[wasm_bindgen]
    pub fn dispatch(&mut self, action: &Object) -> Result<Object> {
        let ty = Reflect::get(action, strings::ty())?
            .as_string()
            .ok_or("action.type is not a string")?;

        let payload = Reflect::get(action, strings::payload())?;
        let payload = if payload.is_undefined() {
            Object::new()
        } else {
            payload
                .dyn_into::<Object>()
                .map_err(|_| "action.payload must be undefined or an object")?
        };

        let mut root_b = Builder::new_default();
        let msg_b = root_b.init_root::<message::Builder>();

        let out = Object::new();
        let mut should_confirm = true;

        let sync_ts = self.inner.now();

        match ty.as_str() {
            "aware/setActiveFeatures" => {
                let value = get_features(&payload, strings::features())?;
                let aware = sync_core::Aware {
                    active_features: value,
                    ..self.my_aware().clone()
                };
                self.inner
                    .set_aware(msg_b.init_aware(), self.id(), Some(&aware))?;
                should_confirm = false;
            }
            "aware/touch" => {
                let aware = self.my_aware().clone();
                self.inner
                    .set_aware(msg_b.init_aware(), self.id(), Some(&aware))?;
                should_confirm = false;
            }

            "attr/set" => {
                let key = get_string(&payload, strings::key()).map(attr::Key)?;
                let value = attr_from_js(Reflect::get(&payload, strings::value())?)?;

                self.inner.set_attr(msg_b.init_delta(), &key, &value)?;
            }

            "layer/add" => {
                let id = get_layer(&payload, strings::id())?;

                let before = self.inner.layers().order().last();
                self.inner
                    .move_layer(msg_b.init_delta(), id, before, None)?;
            }
            "layer/setAttr" => {
                let id = get_layer(&payload, strings::layer())?;
                let key = get_string(&payload, strings::key()).map(attr::Key)?;
                let value = attr_from_js(Reflect::get(&payload, strings::value())?)?;

                self.inner
                    .set_layer_attr(msg_b.init_delta(), id, &key, &value)?;
            }
            "layer/move" => {
                let id = get_layer(&payload, strings::layer())?;
                let before = get_optional_layer(&payload, strings::before())?;
                let after = get_optional_layer(&payload, strings::after())?;

                self.inner
                    .move_layer(msg_b.init_delta(), id, before, after)?;
            }
            "layer/remove" => {
                let id = get_layer(&payload, strings::layer())?;

                self.inner.remove_layer(msg_b.init_delta(), id)?;
            }

            "feature/createGroup" => {
                let id = self.inner.create_group(msg_b)?;
                Reflect::set(&out, strings::id(), &feature_to_str(id).into())?;
            }
            "feature/setAttr" => {
                let id = get_feature(&payload, strings::feature())?;
                let key = get_string(&payload, strings::key()).map(attr::Key)?;
                let value = attr_from_js(Reflect::get(&payload, strings::value())?)?;

                self.inner
                    .set_feature_attr(msg_b.init_delta(), id, &key, &value)?;
            }
            "feature/move" => {
                let ids = get_features(&payload, strings::ids())?;
                let parent = get_feature(&payload, strings::parent())?;
                let before = get_optional_feature(&payload, strings::before())?;
                let after = get_optional_feature(&payload, strings::after())?;

                self.inner
                    .move_features(msg_b.init_delta(), &ids, parent, before, after)?;
            }
            "feature/delete" => {
                let id = get_feature(&payload, strings::feature())?;

                self.inner.delete_feature(msg_b.init_delta(), id)?;
            }
            other => return Err(format!("unknown action type: {}", other).into()),
        }

        let sync_ts = l_instant_to_str(None, sync_ts);
        Reflect::set(&out, strings::syncTs(), &sync_ts.into())?;

        let mut msg_out = Vec::with_capacity(64);
        serialize_packed::write_message(&mut msg_out, &root_b).expect("infallible write");
        let msg_out = Uint8Array::from(msg_out.as_slice());
        Reflect::set(&out, strings::sync(), &msg_out.into())?;

        Reflect::set(&out, strings::shouldConfirm(), &should_confirm.into())?;

        Ok(out)
    }

    #[wasm_bindgen]
    pub fn state(&mut self) -> Result<Object> {
        // TODO: Invert responsibility. Have functions like update_state_aware, update_state_features etc
        // Call them in dispatch and recv
        if !self.inner.aware().is_dirty()
            && !self.inner.attrs().is_dirty()
            && !self.inner.layers().is_dirty()
            && !self.inner.features().is_dirty()
        {
            return Ok(self.state_cache.root.clone());
        }

        self.maybe_update_cached_aware()?;
        self.maybe_update_cached_attrs()?;
        self.maybe_update_cached_layers()?;
        self.maybe_update_cached_features()?;

        let js = Object::new();
        Reflect::set(&js, strings::aware(), &self.state_cache.aware)?;
        Reflect::set(&js, strings::attrs(), &self.state_cache.attrs)?;
        Reflect::set(&js, strings::layers(), &self.state_cache.layers)?;
        Reflect::set(&js, strings::features(), &self.state_cache.features)?;
        self.state_cache.root = js.clone();

        Ok(js)
    }

    fn maybe_update_cached_aware(&mut self) -> Result<()> {
        let my_id = self.id();
        let aware = self.inner.aware_mut();

        if !aware.is_dirty() {
            return Ok(());
        }

        let peers_js = Object::new();
        for (client, entry) in aware.iter() {
            if client != my_id && !entry.is_server {
                Reflect::set(
                    &peers_js,
                    &client_to_str(client),
                    &aware_entry_to_js(entry)?.into(),
                )?;
            }
        }

        let my_js = if let Some(entry) = aware.get(my_id) {
            aware_entry_to_js(entry)?
        } else {
            aware_entry_to_js(&Default::default())?
        };

        let js = Object::new();
        Reflect::set(&js, strings::my(), &my_js)?;
        Reflect::set(&js, strings::myId(), &client_to_str(my_id))?;
        Reflect::set(&js, strings::peers(), &peers_js)?;

        self.state_cache.aware = js;
        aware.clear_dirty();

        Ok(())
    }

    fn maybe_update_cached_attrs(&mut self) -> Result<()> {
        let attrs = self.inner.attrs_mut();

        if !attrs.is_dirty() {
            return Ok(());
        }

        let js = Object::new();
        for (k, v) in attrs.iter() {
            Reflect::set(&js, &JsString::from(intern(k.as_ref())), &attr_to_js(v))?;
        }

        attrs.clear_dirty();
        self.state_cache.attrs = js;

        Ok(())
    }

    fn maybe_update_cached_layers(&mut self) -> Result<()> {
        let layers = self.inner.layers_mut();

        if !layers.is_dirty() {
            return Ok(());
        }

        let mut unused = self
            .state_cache
            .layer_items
            .keys()
            .copied()
            .collect::<HashSet<_>>();

        let js = Array::new();
        let order = layers.order().collect::<Vec<_>>();
        for id in order {
            unused.remove(&id);
            let attrs = layers.attrs_mut(id).expect("non-dirty layer exists");

            if !attrs.is_dirty() {
                if let Some(item_js) = self.state_cache.layer_items.get(&id) {
                    js.push(item_js);
                }
                continue;
            }

            let item_js = Object::new();
            set_layer_id(&item_js, id)?;

            let attrs_js = Object::new();
            for (k, v) in attrs.iter() {
                Reflect::set(
                    &attrs_js,
                    &JsString::from(intern(k.as_ref())),
                    &attr_to_js(v),
                )?;
            }
            Reflect::set(&item_js, strings::attrs(), &attrs_js)?;

            js.push(item_js.as_ref());
            self.state_cache.layer_items.insert(id, item_js);
            attrs.clear_dirty();
        }
        layers.clear_dirty();
        self.state_cache.layers = js;

        for id in unused {
            self.state_cache.layer_items.remove(&id);
        }

        Ok(())
    }

    fn maybe_update_cached_features(&mut self) -> Result<()> {
        let features = self.inner.features_mut();

        if !features.is_dirty() {
            return Ok(());
        }

        // Compute order

        let feature_order_js = Object::new();

        let mut unused_order_items = self
            .state_cache
            .feature_orders
            .keys()
            .copied()
            .collect::<HashSet<_>>();

        for group in features.groups() {
            unused_order_items.remove(&group);
            let children = features.child_order(group).expect("group exists");

            self.hasher.reset();
            for (child, _ty) in children.clone() {
                let child = child.into_inner();
                self.hasher.update(&child.counter.to_le_bytes());
                self.hasher.update(&child.client.into_inner().to_le_bytes());
            }
            let new_hash = self.hasher.digest();

            if let Some(old) = self.state_cache.feature_orders.get(&group) {
                if new_hash == old.hash {
                    Reflect::set(&feature_order_js, &feature_to_str(group), old.js.as_ref())?;
                    continue;
                }
            }

            let js = Array::new();
            for (child, _ty) in children {
                js.push(&feature_to_str(child));
            }

            Reflect::set(&feature_order_js, &feature_to_str(group), &js)?;

            self.state_cache
                .feature_orders
                .insert(group, FeatureOrderItem { hash: new_hash, js });
        }

        for id in unused_order_items {
            self.state_cache.feature_orders.remove(&id);
        }

        // Compute value

        let feature_value_js = Object::new();
        let mut unused_value_items = self
            .state_cache
            .feature_values
            .keys()
            .copied()
            .collect::<HashSet<_>>();

        let live_ids = features.live().collect::<Vec<_>>();
        for feature in live_ids {
            let Some(parent) = features.parent(feature) else {
                // Not in tree
                continue;
            };

            let ty = features.ty(feature).expect("feature exists");
            let linear_idx = features.linear_idx(feature).expect("feature exists");
            let attrs = features.attrs_mut(feature).expect("feature exists");

            unused_value_items.remove(&feature);

            if !attrs.is_dirty() {
                let js = self
                    .state_cache
                    .feature_values
                    .get(&feature)
                    .expect("non-dirty exists");
                Reflect::set(&feature_value_js, &feature_to_str(feature), &js)?;
                continue;
            }

            let js = Object::new();
            set_feature_id(&js, feature)?;
            set_feature_ty(&js, ty)?;
            Reflect::set(&js, strings::parent(), &feature_to_str(parent))?;
            Reflect::set(&js, strings::linearIdx(), &linear_idx.into())?;

            let attrs_js = Object::new();
            for (k, v) in attrs.iter() {
                Reflect::set(
                    &attrs_js,
                    &JsString::from(intern(k.as_ref())),
                    &attr_to_js(v),
                )?;
            }
            Reflect::set(&js, strings::attrs(), &attrs_js)?;

            Reflect::set(&feature_value_js, &feature_to_str(feature), &js)?;

            attrs.clear_dirty();
            self.state_cache.feature_values.insert(feature, js);
        }

        let features_js = Object::new();
        Reflect::set(&features_js, strings::order(), &feature_order_js)?;
        Reflect::set(&features_js, strings::value(), &feature_value_js)?;

        self.state_cache.features = features_js;
        features.clear_dirty();

        Ok(())
    }

    fn id(&self) -> ClientId {
        self.inner.id()
    }

    fn my_aware(&self) -> &Aware {
        self.inner.aware().get_my()
    }

    #[wasm_bindgen]
    pub fn toString(&self) -> String {
        format!("{:#?}", self)
    }
}

fn get_optional_layer(o: &Object, key: &JsString) -> Result<Option<layer::Id>> {
    let v = Reflect::get(o, key)?;
    if v.is_undefined() || v.is_null() {
        return Ok(None);
    }
    let v = v.as_string().ok_or_else(|| format!("{key} not a string"))?;
    let v = layer_from_str(&v)?;
    Ok(Some(v))
}

fn get_layer(o: &Object, key: &JsString) -> Result<layer::Id> {
    let v = get_string(o, key)?;
    layer_from_str(&v)
}

fn get_optional_feature(o: &Object, key: &JsString) -> Result<Option<feature::Id>> {
    let v = Reflect::get(o, key)?;
    if v.is_undefined() || v.is_null() {
        return Ok(None);
    }
    let v = v.as_string().ok_or_else(|| format!("{key} not a string"))?;
    let v = feature_from_str(&v)?;
    Ok(Some(v))
}

fn get_feature(o: &Object, key: &JsString) -> Result<feature::Id> {
    let v = get_string(o, key)?;
    feature_from_str(&v)
}

fn get_features(o: &Object, key: &JsString) -> Result<SmallVec<[feature::Id; 1]>> {
    let mut list = SmallVec::new();

    let v = Reflect::get(o, key)?;
    if v.is_undefined() || v.is_null() {
        return Ok(list);
    }

    let v = v
        .dyn_into::<Array>()
        .map_err(|_| format!("{key} not an array"))?;

    list.reserve(v.length() as usize);
    for id in v.iter() {
        let id = id
            .as_string()
            .ok_or("feature id not a string".into())
            .and_then(|s| feature_from_str(&s))?;
        list.push(id);
    }

    Ok(list)
}

fn get_string(o: &Object, key: &JsString) -> Result<String> {
    let v = Reflect::get(o, key)?;
    let v = v.as_string().ok_or_else(|| format!("{key} not a string"))?;
    Ok(v)
}

fn set_layer_id(o: &Object, v: layer::Id) -> Result<()> {
    Reflect::set(o, strings::id(), &JsString::from(layer_to_str(v)))?;
    Ok(())
}

fn set_feature_id(o: &Object, v: feature::Id) -> Result<()> {
    Reflect::set(o, strings::id(), &JsString::from(feature_to_str(v)))?;
    Ok(())
}

fn set_feature_ty(o: &Object, v: feature::Type) -> Result<()> {
    Reflect::set(o, strings::ty(), &JsValue::from(v.into_inner()))?;
    Ok(())
}

fn feature_from_str(value: &str) -> Result<feature::Id> {
    let value = value.as_bytes();
    if value[0] != b'F' {
        return Err("feature id missing prefix".into());
    }
    let ts = l_instant_from_str(&value[1..])?;
    Ok(ts.into())
}

fn l_instant_from_str(value: &[u8]) -> Result<LInstant> {
    let sep = value
        .iter()
        .position(|&b| b == b'@')
        .ok_or("missing separator")?;

    let counter = &value[..sep];
    let client = &value[sep + 1..];

    let counter = hex_to_u64(counter)?;
    let client = hex_to_u64(client)?;

    Ok(LInstant::new(client.into(), counter))
}

fn layer_from_str(value: &str) -> Result<layer::Id> {
    let value = value.as_bytes();
    if value[0] != b'L' {
        return Err("layer id missing prefix".into());
    }
    let value = &value[1..];
    let uuid =
        Uuid::try_parse_ascii(&value).map_err(|_| "failed to parse layer id as ascii uuid")?;
    Ok(layer::Id(uuid))
}

fn client_to_str(id: ClientId) -> JsString {
    let mut out = vec![b'C'];
    u64_to_hex(id.into(), &mut out);
    let out: Vec<u16> = out.into_iter().map(|b| b as u16).collect();
    JsString::from_char_code(&out)
}

fn feature_to_str(id: feature::Id) -> JsString {
    l_instant_to_str(Some(b'F'), id.into_inner())
}

fn l_instant_to_str(prefix: Option<u8>, id: LInstant) -> JsString {
    let mut out = if let Some(prefix) = prefix {
        vec![prefix]
    } else {
        vec![]
    };

    u64_to_hex(id.counter, &mut out);
    out.push(b'@');
    u64_to_hex(id.client.into(), &mut out);
    let out: Vec<u16> = out.into_iter().map(|b| b as u16).collect();
    JsString::from_char_code(&out)
}

fn layer_to_str(id: layer::Id) -> JsString {
    let mut out = vec![b'L'];
    let uuid: Uuid = id.into();
    write!(out, "{}", uuid).expect("infallible write");
    let out: Vec<u16> = out.into_iter().map(|b| b as u16).collect();
    JsString::from_char_code(&out)
}

fn user_to_str(id: UserId) -> JsString {
    let mut out = Vec::new();
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
    write!(out, "{:0x}", x).expect("infallible write");
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
        let mut iter = js_sys::try_iter(&value)?.ok_or("expected iterable")?;

        let first = iter.next().ok_or("expected iterable to not be empty")??;

        if let Some(first) = first.as_f64() {
            let mut out = SmallVec::new();
            out.push(first.into());
            for v in iter {
                let v = v?
                    .as_f64()
                    .ok_or("type of subsequent iterable item must match first: expected number")?;
                out.push(v.into());
            }
            Ok(Value::NumberArray(out))
        } else if let Some(first) = first.as_string() {
            let mut out = SmallVec::new();
            out.push(first.into());
            for v in iter {
                let v = v?
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

fn aware_entry_to_js(entry: &sync_core::Aware) -> Result<Object> {
    let js = Object::new();

    let sync_core::Aware {
        active_features,
        is_server: _,
        user,
    } = entry;

    if let Some(id) = user {
        Reflect::set(&js, strings::user(), &user_to_str(*id).into())?;
    } else {
        Reflect::set(&js, strings::user(), &JsValue::UNDEFINED)?;
    }

    {
        let value = Array::new();
        for f in active_features.iter() {
            value.push(&feature_to_str(*f).into());
        }
    }

    Ok(js)
}

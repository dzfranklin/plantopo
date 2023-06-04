use capnp::{serialize_packed, traits::OwnedStruct};

use crate::{
    capnp_support::{
        read_frac_idx, read_l_instant, read_uuid, write_attr, write_frac_idx, write_l_instant,
        write_uuid,
    },
    delta_capnp,
    prelude::*,
    sync_capnp,
};

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Delta {
    pub confirm_key: Option<LInstant>,

    pub aware: Vec<(ClientId, Option<Aware>)>,

    pub layers: Vec<LayerDelta>,
    pub live_features: Vec<FeatureDelta>,
    pub dead_features: Vec<feature::Id>,
    pub attrs: AttrVec,
}

type AttrVec = Vec<(attr::Key, LwwReg<attr::Value>)>;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct LayerDelta {
    pub id: layer::Id,
    pub at: LwwReg<Option<FracIdx>>,
    pub attrs: AttrVec,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct FeatureDelta {
    pub id: feature::Id,
    pub ty: feature::Type,
    pub at: LwwReg<Option<feature::At>>,
    pub attrs: AttrVec,
}

impl LayerDelta {
    pub fn new(id: layer::Id) -> Self {
        Self {
            id,
            at: LwwReg::unset(),
            attrs: Vec::new(),
        }
    }
}

impl FeatureDelta {
    pub fn new(id: feature::Id, ty: feature::Type) -> Self {
        Self {
            id,
            ty,
            at: LwwReg::unset(),
            attrs: Vec::new(),
        }
    }
}

impl Delta {
    pub fn new(confirm_key: Option<LInstant>) -> Self {
        Self {
            confirm_key,
            aware: Default::default(),
            layers: Default::default(),
            live_features: Default::default(),
            dead_features: Default::default(),
            attrs: Default::default(),
        }
    }
}

impl TryFrom<delta_capnp::delta::Reader<'_>> for Delta {
    type Error = crate::Error;

    fn try_from(r: delta_capnp::delta::Reader) -> Result<Self> {
        let confirm_key = if r.has_confirm_key() {
            Some(read_l_instant(r.get_confirm_key()?))
        } else {
            None
        };

        let aware = r
            .get_aware()?
            .get_value()?
            .into_iter()
            .map(|r| {
                let client = ClientId(r.get_client());
                let entry = if r.get_disconnect() {
                    None
                } else {
                    Some(Aware {
                        is_server: r.get_is_server(),
                        user: if r.has_user() {
                            let user = read_uuid(r.get_user()?);
                            Some(user.into())
                        } else {
                            None
                        },
                        active_features: r
                            .get_active_features()?
                            .into_iter()
                            .map(|r| read_l_instant(r).into())
                            .collect(),
                    })
                };
                Ok((client, entry))
            })
            .collect::<Result<_>>()?;

        let layers = r
            .get_layers()?
            .get_value()?
            .into_iter()
            .map(|r| {
                let at_ts = if r.has_at_ts() {
                    read_l_instant(r.get_at_ts()?)
                } else {
                    LInstant::zero()
                };
                let at_value = if r.has_at() {
                    Some(read_frac_idx(r.get_at()?)?)
                } else {
                    None
                };
                Ok(LayerDelta {
                    id: read_uuid(r.get_id()?).into(),
                    at: LwwReg::new(at_value, at_ts),
                    attrs: read_attrs(r.get_attrs()?)?,
                })
            })
            .collect::<Result<_>>()?;

        let features_r = r.get_features()?;

        let live_features = features_r
            .get_live()?
            .into_iter()
            .map(|r| {
                let at_ts = if r.has_at_ts() {
                    read_l_instant(r.get_at_ts()?)
                } else {
                    LInstant::zero()
                };
                let at_value = if r.has_at_idx() && r.has_at_parent() {
                    let idx = read_frac_idx(r.get_at_idx()?)?;
                    let parent = read_l_instant(r.get_at_parent()?).into();
                    Some(feature::At { idx, parent })
                } else {
                    None
                };

                Ok(FeatureDelta {
                    id: read_l_instant(r.get_id()?).into(),
                    ty: feature::Type(r.get_type()),
                    at: LwwReg::new(at_value, at_ts),
                    attrs: read_attrs(r.get_attrs()?)?,
                })
            })
            .collect::<Result<_>>()?;

        let dead_features = features_r
            .get_dead()?
            .into_iter()
            .map(|r| Ok(read_l_instant(r.get_id()?).into()))
            .collect::<Result<_>>()?;

        let attrs = read_attrs(r.get_attrs()?)?;

        Ok(Self {
            confirm_key,
            aware,
            layers,
            live_features,
            dead_features,
            attrs,
        })
    }
}

fn read_attrs(
    r: delta_capnp::delta::attrs::Reader,
) -> Result<Vec<(attr::Key, LwwReg<attr::Value>)>> {
    use attr::Value;
    use delta_capnp::delta::attrs::attr::value::Which;

    r.get_value()?
        .into_iter()
        .map(|r| {
            let key = attr::Key(r.get_key()?.to_owned());
            let ts = read_l_instant(r.get_ts()?);
            let value = match r.get_value().which() {
                Err(capnp::NotInSchema(n)) => {
                    tracing::info!("Unknown attr value variant: {n}");
                    Value::None
                }
                Ok(Which::None(())) => Value::None,
                Ok(Which::Bool(v)) => Value::Bool(v),
                Ok(Which::String(v)) => Value::String(SmolStr::from(v?)),
                Ok(Which::Number(v)) => Value::Number(v.into()),
                Ok(Which::NumberArray(v)) => {
                    let v = v?
                        .as_slice()
                        .ok_or_else(|| {
                            capnp::Error::failed(
                                "number array not as expected in memory".to_string(),
                            )
                        })?
                        .into_iter()
                        .map(|v| OrderedFloat(*v))
                        .collect();
                    Value::NumberArray(v)
                }
                Ok(Which::StringArray(v)) => v?
                    .iter()
                    .map(|v| v.map(SmolStr::from))
                    .collect::<capnp::Result<_>>()
                    .map(Value::StringArray)?,
            };
            let value = LwwReg::new(value, ts);
            Ok((key, value))
        })
        .collect()
}

impl Delta {
    pub fn serialize(&self) -> Vec<u8> {
        let mut builder = capnp::message::Builder::new_default();
        self.write(
            builder
                .init_root::<sync_capnp::message::Builder>()
                .init_delta(),
        );

        let mut out = Vec::with_capacity(64);
        serialize_packed::write_message(&mut out, &builder).expect("infallible writer");
        out
    }

    pub fn write(&self, mut w: delta_capnp::delta::Builder<'_>) {
        if let Some(confirm_key) = self.confirm_key {
            write_l_instant(w.reborrow().init_confirm_key(), confirm_key);
        }

        write_list(
            &self.aware,
            |len| w.reborrow().init_aware().init_value(len),
            |mut w, (client, entry)| {
                w.set_client(client.into_inner());

                if let Some(value) = entry {
                    w.set_is_server(value.is_server);
                    if let Some(user) = value.user {
                        write_uuid(w.reborrow().init_user(), user.into());
                    }
                    write_list(
                        &value.active_features,
                        |len| w.reborrow().init_active_features(len),
                        |w, feature| write_l_instant(w, feature.into_inner()),
                    )
                } else {
                    w.set_disconnect(true);
                }
            },
        );

        write_list(
            &self.layers,
            |len| w.reborrow().init_layers().init_value(len),
            |mut w, layer| {
                write_uuid(w.reborrow().init_id(), layer.id.into());

                write_l_instant(w.reborrow().init_at_ts(), layer.at.ts());
                if let Some(value) = layer.at.as_value() {
                    write_frac_idx(w.reborrow().init_at(), value);
                }

                write_attrs(w.init_attrs(), &layer.attrs);
            },
        );

        let mut features_w = w.reborrow().init_features();

        write_list(
            &self.live_features,
            |len| features_w.reborrow().init_live(len),
            |mut w, feature| {
                write_l_instant(w.reborrow().init_id(), feature.id.into());
                w.set_type(feature.ty.into_inner());

                write_l_instant(w.reborrow().init_at_ts(), feature.at.ts());
                if let Some(value) = feature.at.as_value() {
                    write_frac_idx(w.reborrow().init_at_idx(), &value.idx);
                    write_l_instant(w.reborrow().init_at_parent(), value.parent.into());
                }

                write_attrs(w.init_attrs(), &feature.attrs);
            },
        );

        write_list(
            &self.dead_features,
            |len| features_w.init_dead(len),
            |w, feature| write_l_instant(w.init_id(), feature.into_inner()),
        );

        write_attrs(w.init_attrs(), &self.attrs);
    }
}

fn write_list<'a, Init, Source, Struct, Build>(value: &[Source], init: Init, mut build: Build)
where
    Init: FnOnce(u32) -> ::capnp::struct_list::Builder<'a, Struct>,
    Struct: OwnedStruct,
    Build: FnMut(Struct::Builder<'_>, &Source),
{
    let mut w = init(value.len() as u32);
    for (i, v) in value.iter().enumerate() {
        let w = w.reborrow();
        build(w.get(i as u32), v)
    }
}

fn write_attrs(
    w: delta_capnp::delta::attrs::Builder<'_>,
    attrs: &[(attr::Key, LwwReg<attr::Value>)],
) {
    write_list(
        attrs,
        |len| w.init_value(len),
        |w, (key, value)| write_attr(w, key, value.as_value(), value.ts()),
    )
}

use crate::prelude::*;
use rand_chacha::ChaCha20Rng;

pub struct Client<LayerOrderSub, FeatureOrderSub, LayerAttrSub, FeatureAttrSub> {
    id: ClientId,
    rng: ChaCha20Rng,
    clock: VClock,
    features: TPMap<feature::Id, Feature>,
    feature_order: BTreeMap<feature::Id, SmallVec<[(FracIdx, feature::Id); 1024]>>,
    feature_order_subs: SubscriberRegistry<feature::Id, FeatureOrderSub>,
    feature_attr_subs: SubscriberRegistry<feature::Id, FeatureAttrSub>,
    layers: GMap<layer::Id, Layer>,
    layer_order: SmallVec<[(FracIdx, layer::Id); 16]>,
    layer_order_subs: SubscriberRegistry<(), LayerOrderSub>,
    layer_attr_subs: SubscriberRegistry<layer::Id, LayerAttrSub>,
}

// We need to manually implement Debug so that the impl doesn't require the
// subscribers to be debug.
impl<LOS, FOS, LAS, FAS> fmt::Debug for Client<LOS, FOS, LAS, FAS> {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.debug_struct("Client")
            .field("id", &self.id)
            .field("rng", &self.rng)
            .field("clock", &self.clock)
            .field("features", &self.features)
            .field("feature_order", &self.feature_order)
            .field("feature_order_subs", &self.feature_order_subs)
            .field("feature_attr_subs", &self.feature_attr_subs)
            .field("layers", &self.layers)
            .field("layer_order", &self.layer_order)
            .field("layer_order_subs", &self.layer_order_subs)
            .field("layer_attr_subs", &self.layer_attr_subs)
            .finish()
    }
}

#[derive(Debug, Serialize, Deserialize)]
struct ClientSave<'a> {
    id: ClientId,
    clock: Cow<'a, VClock>,
    rng: ChaCha20Rng,
    features: Cow<'a, TPMap<feature::Id, Feature>>,
    layers: Cow<'a, GMap<layer::Id, Layer>>,
}

impl<LayerOrderSub, FeatureOrderSub, LayerAttrSub, FeatureAttrSub>
    Client<LayerOrderSub, FeatureOrderSub, LayerAttrSub, FeatureAttrSub>
where
    LayerOrderSub: Fn(LayerOrderIter<'_>),
    FeatureOrderSub: Fn(FeatureOrderIter<'_>),
    LayerAttrSub: Fn(AttrIter<'_>),
    FeatureAttrSub: Fn(AttrIter<'_>),
{
    pub fn new(id: ClientId) -> Self {
        Self {
            id,
            rng: ChaCha20Rng::seed_from_u64(id.0 as u64),
            clock: VClock::new(),
            features: TPMap::new(),
            feature_order: BTreeMap::new(),
            feature_order_subs: SubscriberRegistry::new(),
            feature_attr_subs: SubscriberRegistry::new(),
            layers: GMap::new(),
            layer_order: SmallVec::new(),
            layer_order_subs: SubscriberRegistry::new(),
            layer_attr_subs: SubscriberRegistry::new(),
        }
    }

    pub fn restore(bytes: &[u8]) -> core::result::Result<Self, postcard::Error> {
        let ClientSave {
            id,
            clock,
            rng,
            features,
            layers,
        } = postcard::from_bytes(bytes)?;

        let clock = clock.into_owned();
        let features = features.into_owned();
        let layers = layers.into_owned();

        let mut feature_order = BTreeMap::new();
        for (_, feature) in features.iter() {
            let at = match feature.at().as_value() {
                Some(at) => at.clone(),
                None => continue,
            };

            let sibs = feature_order.entry(at.parent).or_insert_with(SmallVec::new);
            // We insert out of order and then sort once per vec
            sibs.push((at.idx, feature.id()));
        }
        for (_, sibs) in feature_order.iter_mut() {
            sibs.sort();
        }

        let mut layer_order = SmallVec::new();
        for (&id, layer) in layers.iter() {
            if let Some(at) = layer.at.as_value() {
                // We insert out of order and then sort once
                layer_order.push((at.clone(), id));
            }
        }
        layer_order.sort();

        Ok(Self {
            id,
            clock,
            rng,
            features,
            feature_order,
            feature_order_subs: SubscriberRegistry::new(),
            feature_attr_subs: SubscriberRegistry::new(),
            layers,
            layer_order,
            layer_attr_subs: SubscriberRegistry::new(),
            layer_order_subs: SubscriberRegistry::new(),
        })
    }

    pub fn save(&self) -> core::result::Result<alloc::vec::Vec<u8>, postcard::Error> {
        let value = ClientSave {
            id: self.id,
            clock: Cow::Borrowed(&self.clock),
            rng: self.rng.clone(),
            features: Cow::Borrowed(&self.features),
            layers: Cow::Borrowed(&self.layers),
        };
        postcard::to_allocvec(&value)
    }

    pub fn id(&self) -> ClientId {
        self.id
    }

    pub fn clock(&self) -> &VClock {
        &self.clock
    }

    pub fn unseen_by(&self, peer: &VClock) -> alloc::vec::Vec<Op> {
        let mut out = alloc::vec::Vec::new();

        for (_, f) in self.features.iter() {
            if !peer.has_observed(f.create_ts()) {
                out.push(Op::new(f.create_ts(), op::Action::CreateFeature(f.ty())));
            }

            if !peer.has_observed(f.trashed().ts()) && f.trashed().ts() > f.create_ts() {
                out.push(Op::new(
                    f.trashed().ts(),
                    op::Action::SetFeatureTrashed {
                        id: f.id(),
                        value: *f.trashed().as_value(),
                    },
                ));
            }

            if !peer.has_observed(f.at().ts()) && f.at().ts() > f.create_ts() {
                out.push(Op::new(
                    f.at().ts(),
                    op::Action::MoveFeature {
                        id: f.id(),
                        at: f.at().as_value().clone(),
                    },
                ));
            }

            for (key, value) in f.attrs().iter() {
                if !peer.has_observed(value.ts()) {
                    out.push(Op::new(
                        value.ts(),
                        op::Action::SetFeatureAttr {
                            id: f.id(),
                            key: key.clone(),
                            value: value.as_value().clone(),
                        },
                    ));
                }
            }
        }

        for (&f, ts) in self.features.iter_dead() {
            if !peer.has_observed(ts) {
                out.push(Op::new(ts, op::Action::DeleteFeature(f)));
            }
        }

        for (_, l) in self.layers.iter() {
            if !peer.has_observed(l.at.ts()) {
                out.push(Op::new(
                    l.at.ts(),
                    op::Action::MoveLayer {
                        id: l.id,
                        at: l.at.as_value().clone(),
                    },
                ));
            }

            for (key, value) in l.attrs.iter() {
                if !peer.has_observed(value.ts()) {
                    out.push(Op::new(
                        value.ts(),
                        op::Action::SetLayerAttr {
                            id: l.id,
                            key: key.clone(),
                            value: value.as_value().clone(),
                        },
                    ));
                }
            }
        }

        out.sort_by_key(|op| op.ts);

        out
    }

    pub fn apply(&mut self, op: Op) {
        test_log!("apply: {:?} (self is {:?})", &op, self.clock);

        let Op { ts, action } = op;

        self.clock.set(ts);
        let prev = self.clock.get(self.id);
        self.clock.set(prev.with_counter(prev.max_counter(ts) + 1));

        let _res = match action {
            op::Action::MoveLayer { id, at } => self._move_layer(id, at, ts),
            op::Action::SetLayerAttr { id, key, value } => self._set_layer_attr(id, key, value, ts),
            op::Action::CreateFeature(ty) => self._create_feature(ty, ts),
            op::Action::MoveFeature { id, at } => self._move_feature(id, at, ts),
            op::Action::SetFeatureTrashed { id, value } => self._set_feature_trashed(id, value, ts),
            op::Action::SetFeatureAttr { id, key, value } => {
                self._set_feature_attr(id, key, value, ts)
            }
            op::Action::DeleteFeature(id) => self._delete_feature(id, ts),
        };

        test_log!("apply:\tresult {:?}", _res);
    }

    pub fn subscribe_feature_order(&mut self, parent: feature::Id, sub: FeatureOrderSub) -> u32 {
        {
            let children = self.feature_children(parent);
            sub(children);
        }
        self.feature_order_subs.insert(parent, sub)
    }

    pub fn unsubscribe_feature_order(&mut self, handle: u32) {
        self.feature_order_subs.remove(handle);
    }

    pub fn feature_children(&self, parent: feature::Id) -> FeatureOrderIter {
        if let Some(sibs) = self.feature_order.get(&parent) {
            FeatureOrderIter(Some(sibs.iter()))
        } else {
            FeatureOrderIter(None)
        }
    }

    pub fn subscribe_feature_attrs(&mut self, feature: feature::Id, sub: FeatureAttrSub) -> u32 {
        if let Some(attrs) = self.feature_attrs(feature) {
            sub(attrs);
        }
        self.feature_attr_subs.insert(feature, sub)
    }

    pub fn unsubscribe_feature_attrs(&mut self, handle: u32) {
        self.feature_attr_subs.remove(handle);
    }

    pub fn feature_attrs(&self, feature: feature::Id) -> Option<AttrIter> {
        self.features
            .get(&feature)
            .map(|feature| AttrIter(feature.attrs().iter()))
    }

    pub fn subscribe_layer_order(&mut self, sub: LayerOrderSub) -> u32 {
        sub(self.layer_order());
        self.layer_order_subs.insert((), sub)
    }

    pub fn unsubscribe_layer_order(&mut self, handle: u32) {
        self.layer_order_subs.remove(handle);
    }

    pub fn layer_order(&self) -> LayerOrderIter {
        LayerOrderIter(self.layer_order.iter())
    }

    pub fn subscribe_layer_attrs(&mut self, layer: layer::Id, sub: LayerAttrSub) -> u32 {
        if let Some(attrs) = self.layer_attrs(layer) {
            sub(attrs);
        }
        self.layer_attr_subs.insert(layer, sub)
    }

    pub fn unsubscribe_layer_attrs(&mut self, handle: u32) {
        self.layer_attr_subs.remove(handle);
    }

    pub fn layer_attrs(&self, layer: layer::Id) -> Option<AttrIter> {
        if let Some(layer) = self.layers.get(&layer) {
            if layer.at.as_value().is_none() {
                return None;
            }
            Some(AttrIter(layer.attrs.iter()))
        } else {
            None
        }
    }

    pub fn create_feature(&mut self, ty: feature::Type) -> Result<(feature::Id, Op)> {
        let ts = self.clock.tick(self.id);
        self._create_feature(ty, ts)?;
        let id = feature::Id(ts);
        let op = Op::new(ts, op::Action::CreateFeature(ty));
        Ok((id, op))
    }

    fn _create_feature(&mut self, ty: feature::Type, ts: LInstant) -> Result<()> {
        let feature = Feature::new(ts, ty);
        let id = feature.id();

        self.features
            .insert(id, feature)
            .map_err(|_| "feature not valid for insertion")?;

        if ty == feature::Type::GROUP {
            self.feature_order.insert(id, SmallVec::new());
        }

        Ok(())
    }

    pub fn set_feature_trashed(&mut self, id: feature::Id, value: bool) -> Result<Op> {
        let ts = self.clock.tick(self.id);
        self._set_feature_trashed(id, value, ts)?;
        Ok(Op::new(ts, op::Action::SetFeatureTrashed { id, value }))
    }

    fn _set_feature_trashed(&mut self, id: feature::Id, value: bool, ts: LInstant) -> Result<()> {
        self.features
            .merge_value(
                id,
                feature::WritableData {
                    trashed: LwwReg::new(value, ts),
                    ..Default::default()
                },
            )
            .map_err(|_| "cannot trash nonexistant")
    }

    pub fn set_feature_attr(
        &mut self,
        id: feature::Id,
        key: impl Into<SmolStr>,
        value: AttrValue,
    ) -> Result<Op> {
        let key = key.into();
        let ts = self.clock.tick(self.id);
        self._set_feature_attr(id, key.clone(), value.clone(), ts)?;
        Ok(Op::new(ts, op::Action::SetFeatureAttr { id, key, value }))
    }

    fn _set_feature_attr(
        &mut self,
        id: feature::Id,
        key: SmolStr,
        value: AttrValue,
        ts: LInstant,
    ) -> Result<()> {
        self.features
            .merge_value(
                id,
                feature::WritableData {
                    attrs: GMap::from_entries([(key, LwwReg::new(value, ts))]),
                    ..Default::default()
                },
            )
            .map_err(|_| "cannot set feature attr on nonexistant")
    }

    pub fn move_feature(
        &mut self,
        id: feature::Id,
        parent: feature::Id,
        before: Option<feature::Id>,
        after: Option<feature::Id>,
    ) -> Result<Op> {
        let before = if let Some(id) = before {
            let at = self
                .features
                .get(&id)
                .ok_or("missing feature")?
                .at()
                .as_value()
                .as_ref()
                .ok_or("missing at")?;
            Some(at)
        } else {
            None
        };
        let after = if let Some(id) = after {
            let at = self
                .features
                .get(&id)
                .ok_or("missing feature")?
                .at()
                .as_value()
                .as_ref()
                .ok_or("missing at")?;
            Some(at)
        } else {
            None
        };

        if let Some(before) = before && before.parent != parent {
            return Err("not parent of before");
        }
        if let Some(after) = after && after.parent != parent {
            return Err("not parent of after");
        }
        if let Some(before) = before && let Some(after) = after && before == after {
            return Err("before and after are the same");
        }

        let before = before.map(|v| &v.idx);
        let after = after.map(|v| &v.idx);

        let idx = FracIdx::between(before, after, &mut self.rng);
        let at = feature::At { parent, idx };

        let ts = self.clock.tick(self.id);
        self._move_feature(id, Some(at.clone()), ts)?;
        Ok(Op::new(ts, op::Action::MoveFeature { id, at: Some(at) }))
    }

    fn _move_feature(
        &mut self,
        id: feature::Id,
        at: Option<feature::At>,
        ts: LInstant,
    ) -> Result<()> {
        let prev_parent = self
            .features
            .get(&id)
            .and_then(|f| f.at().as_value().as_ref())
            .map(|at| at.parent);

        self.features
            .merge_value(
                id,
                feature::WritableData {
                    at: LwwReg::new(at.clone(), ts),
                    ..Default::default()
                },
            )
            .map_err(|_| "cannot move nonexistant")?;

        let mut changed_parent = None;

        if let Some(prev_parent) = prev_parent {
            if let Some(prev_sibs) = self.feature_order.get_mut(&prev_parent) {
                prev_sibs.retain(|(_, sib)| sib != &id);
            }

            if let Some(at) = &at && at.parent != prev_parent {
                changed_parent = Some(prev_parent);
            }
        }

        if let Some(at) = at {
            let at_parent = at.parent;

            let sibs = self
                .feature_order
                .entry(at.parent)
                .or_insert_with(SmallVec::new);

            let elem = (at.idx, id);
            match sibs.binary_search(&elem) {
                Ok(_) => {}
                Err(idx) => {
                    sibs.insert(idx, elem);
                }
            }

            self.feature_order_subs
                .call(&at_parent, self.feature_children(at_parent));
        }

        if let Some(prev_parent) = changed_parent {
            self.feature_order_subs
                .call(&prev_parent, self.feature_children(prev_parent));
        }

        Ok(())
    }

    pub fn delete_feature(&mut self, id: feature::Id) -> Result<Op> {
        let ts = self.clock.tick(self.id);
        self._delete_feature(id, ts)?;
        Ok(Op::new(ts, op::Action::DeleteFeature(id)))
    }

    fn _delete_feature(&mut self, id: feature::Id, ts: LInstant) -> Result<()> {
        if !self.features.contains_key(&id) {
            // We deliberately allow deleting a nonexistant feature to
            // simplify snapshotting the state as a list of ops: You only need
            // to keep deletions, not matching creates.
            //
            // If the feature doesn't exist no one else can know about it,
            // so we don't have to worry about subscribers or children.
            self.features
                .delete(id, ts)
                .map_err(|_| "already deleted")?;
            return Ok(());
        }

        fn inner<LOS, FOS, LAS, FAS>(
            client: &mut Client<LOS, FOS, LAS, FAS>,
            id: feature::Id,
            ts: LInstant,
            dirty_parents: &mut BTreeSet<feature::Id>,
        ) {
            if let Ok(feat) = client.features.delete(id, ts) {
                if let Some(at) = feat.at().as_value() {
                    if let Some(sibs) = client.feature_order.get_mut(&at.parent) {
                        sibs.retain(|(_, sib)| sib != &feat.id());
                    }
                }

                if feat.ty() == feature::Type::GROUP {
                    let direct_children = client
                        .feature_order
                        .remove(&id)
                        .unwrap_or_else(SmallVec::new);

                    for (_, child) in direct_children {
                        inner(client, child, ts.with_tick(), dirty_parents);
                    }
                }

                if feat.ty() == feature::Type::GROUP {
                    dirty_parents.insert(id);
                }
                if let Some(at) = feat.at().as_value() {
                    dirty_parents.insert(at.parent);
                }
            }
        }

        let mut dirty_parents = BTreeSet::new();
        inner(self, id, ts, &mut dirty_parents);
        for parent in dirty_parents {
            self.feature_order_subs
                .call(&parent, self.feature_children(parent));
        }

        Ok(())
    }

    pub fn move_layer(
        &mut self,
        id: layer::Id,
        before: Option<layer::Id>,
        after: Option<layer::Id>,
    ) -> Result<Op> {
        let before = if let Some(id) = before {
            let at = self
                .layers
                .get(&id)
                .ok_or("missing layer")?
                .at
                .as_value()
                .as_ref()
                .ok_or("before not active")?;
            Some(at)
        } else {
            None
        };
        let after = if let Some(id) = after {
            let at = self
                .layers
                .get(&id)
                .ok_or("missing layer")?
                .at
                .as_value()
                .as_ref()
                .ok_or("after not active")?;
            Some(at)
        } else {
            None
        };

        if let Some(before) = before && let Some(after) = after && before == after {
            return Err("before and after are the same");
        }

        let at = FracIdx::between(before, after, &mut self.rng);

        let ts = self.clock.tick(self.id);
        self._move_layer(id, Some(at.clone()), ts)?;
        Ok(Op::new(ts, op::Action::MoveLayer { id, at: Some(at) }))
    }

    pub fn remove_layer(&mut self, id: layer::Id) -> Result<Op> {
        let ts = self.clock.tick(self.id);
        self._move_layer(id, None, ts)?;
        Ok(Op::new(ts, op::Action::MoveLayer { id, at: None }))
    }

    fn _move_layer(&mut self, id: layer::Id, at: Option<FracIdx>, ts: LInstant) -> Result<()> {
        self.layers
            .merge_value(
                id,
                Layer {
                    id,
                    at: LwwReg::new(at.clone(), ts),
                    ..Default::default()
                },
            )
            .map_err(|_| "can't move nonexistant layer")?;

        self.layer_order.retain(|(_, l)| l != &id);

        if let Some(at) = at {
            let elem = (at, id);
            match self.layer_order.binary_search(&elem) {
                Ok(_) => {}
                Err(idx) => {
                    self.layer_order.insert(idx, elem);
                }
            }
        }

        Ok(())
    }

    pub fn set_layer_attr(&mut self, id: layer::Id, key: SmolStr, value: AttrValue) -> Result<Op> {
        let ts = self.clock.tick(self.id);
        self._set_layer_attr(id, key.clone(), value.clone(), ts)?;
        Ok(Op::new(ts, op::Action::SetLayerAttr { id, key, value }))
    }

    fn _set_layer_attr(
        &mut self,
        id: layer::Id,
        key: SmolStr,
        value: AttrValue,
        ts: LInstant,
    ) -> Result<()> {
        self.layers
            .merge_value(
                id,
                Layer {
                    id,
                    attrs: GMap::from_entries([(key, LwwReg::new(value, ts))]),
                    ..Default::default()
                },
            )
            .map_err(|_| "can't set attr on nonexistant layer")
    }
}

#[derive(Debug, Clone)]
pub struct FeatureOrderIter<'a>(Option<slice::Iter<'a, (FracIdx, feature::Id)>>);

impl<'a> Iterator for FeatureOrderIter<'a> {
    type Item = feature::Id;

    fn next(&mut self) -> Option<Self::Item> {
        match &mut self.0 {
            None => None,
            Some(iter) => iter.next().map(|(_, id)| *id),
        }
    }
}

impl<'a> Serialize for FeatureOrderIter<'a> {
    fn serialize<S>(&self, ser: S) -> core::result::Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        ser.collect_seq(self.clone())
    }
}

#[derive(Debug, Clone)]
pub struct LayerOrderIter<'a>(slice::Iter<'a, (FracIdx, layer::Id)>);

impl<'a> Iterator for LayerOrderIter<'a> {
    type Item = layer::Id;

    fn next(&mut self) -> Option<Self::Item> {
        self.0.next().map(|(_, id)| *id)
    }
}

impl<'a> Serialize for LayerOrderIter<'a> {
    fn serialize<S>(&self, ser: S) -> core::result::Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        ser.collect_seq(self.clone())
    }
}

#[derive(Debug, Clone)]
pub struct AttrIter<'a>(g_map::Iter<'a, SmolStr, LwwReg<AttrValue>>);

impl<'a> Iterator for AttrIter<'a> {
    type Item = (&'a SmolStr, &'a AttrValue);

    fn next(&mut self) -> Option<Self::Item> {
        self.0.next().map(|(k, v)| (k, v.as_value()))
    }
}

impl<'a> Serialize for AttrIter<'a> {
    fn serialize<S>(&self, ser: S) -> core::result::Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        ser.collect_seq(self.clone())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[allow(unused)]
    use pretty_assertions::{assert_eq, assert_ne};

    type LayerOrderSub = Box<dyn Fn(LayerOrderIter<'_>) + Send + Sync>;
    type FeatureOrderSub = Box<dyn Fn(FeatureOrderIter<'_>) + Send + Sync>;
    type AttrSub = Box<dyn Fn(AttrIter<'_>) + Send + Sync>;
    type BoxedSubClient = Client<LayerOrderSub, FeatureOrderSub, AttrSub, AttrSub>;

    fn setup() -> BoxedSubClient {
        static ONCE: std::sync::Once = std::sync::Once::new();
        ONCE.call_once(|| {
            color_eyre::install().unwrap();
        });
        let id = ClientId(1);
        Client::new(id)
    }

    #[test]
    fn test_threadsafe_if_subs_are() {
        fn is_send<T: Send>() {}
        fn is_sync<T: Sync>() {}
        is_send::<BoxedSubClient>();
        is_sync::<BoxedSubClient>();
    }

    #[test]
    fn test_create_delete() -> Result<()> {
        let mut client = setup();
        let (pt, _) = client.create_feature(feature::Type::POINT)?;
        client.delete_feature(pt)?;
        assert!(client.delete_feature(pt).is_err());
        Ok(())
    }

    #[test]
    fn test_move_into_blank() -> Result<()> {
        let mut client = setup();

        let (group1, _) = client.create_feature(feature::Type::GROUP)?;
        let (pt, _) = client.create_feature(feature::Type::POINT)?;

        assert!(client.feature_children(group1).next().is_none());

        client.move_feature(pt, group1, None, None)?;

        let actual = client.feature_children(group1).collect::<Vec<_>>();
        assert_eq!(vec![pt], actual);

        let (group2, _) = client.create_feature(feature::Type::GROUP)?;

        client.move_feature(pt, group2, None, None)?;

        assert!(client.feature_children(group1).next().is_none());

        let actual = client.feature_children(group2).collect::<Vec<_>>();
        assert_eq!(vec![pt], actual);

        Ok(())
    }

    #[test]
    fn test_move_between() -> Result<()> {
        let mut client = setup();

        let (group, _) = client.create_feature(feature::Type::GROUP)?;
        let (pt1, _) = client.create_feature(feature::Type::POINT)?;
        let (pt2, _) = client.create_feature(feature::Type::POINT)?;
        let (pt3, _) = client.create_feature(feature::Type::POINT)?;

        client.move_feature(pt1, group, None, None)?;
        client.move_feature(pt3, group, Some(pt1), None)?;
        client.move_feature(pt2, group, Some(pt1), Some(pt3))?;

        let actual = client.feature_children(group).collect::<Vec<_>>();
        assert_eq!(vec![pt1, pt2, pt3], actual);

        Ok(())
    }

    #[test]
    fn test_ser_de() -> Result<()> {
        let mut client = setup();
        let peer = ClientId(2);

        let (group, _) = client.create_feature(feature::Type::GROUP)?;
        let (pt1, _) = client.create_feature(feature::Type::POINT)?;
        let (pt2, _) = client.create_feature(feature::Type::POINT)?;
        let (pt3, _) = client.create_feature(feature::Type::POINT)?;

        let pt1_move = client.move_feature(pt1, group, None, None)?;
        let pt1_idx = match pt1_move.action {
            op::Action::MoveFeature { at: Some(at), .. } => at.idx,
            _ => unreachable!(),
        };

        let pt3_move = Op::new(
            LInstant::new(peer, pt1_move.ts.counter() + 1),
            op::Action::MoveFeature {
                id: pt3,
                at: Some(feature::At {
                    parent: group,
                    idx: FracIdx::between(Some(&pt1_idx), None, &mut client.rng),
                }),
            },
        );
        client.apply(pt3_move);

        client.move_feature(pt2, group, Some(pt1), Some(pt3))?;

        let (group2, _) = client.create_feature(feature::Type::GROUP)?;
        client.delete_feature(group2)?;

        let bytes = client.save().unwrap();
        let client2 = BoxedSubClient::restore(&bytes).unwrap();

        assert_eq!(client.clock, client2.clock);
        assert_eq!(client.rng, client2.rng);
        assert_eq!(client.features, client2.features);
        assert_eq!(client.feature_order, client2.feature_order);

        // Round-trips
        assert_eq!(&bytes, &client2.save().unwrap());

        Ok(())
    }

    #[test]
    fn test_apply_merges_clock() -> Result<()> {
        let mut client = setup();
        let peer = ClientId(2);

        assert_eq!(client.clock.get(client.id).counter(), 0);
        assert_eq!(client.clock.get(peer).counter(), 0);

        let ts = LInstant::new(peer, 42);
        let pt = feature::Id(ts);
        client.apply(Op::new(ts, op::Action::CreateFeature(feature::Type::GROUP)));

        assert_eq!(client.clock.get(client.id).counter(), 43);
        assert_eq!(client.clock.get(peer).counter(), 42);

        client.apply(Op::new(
            LInstant::new(peer, 1),
            op::Action::DeleteFeature(pt),
        ));

        assert_eq!(client.clock.get(client.id).counter(), 44);
        assert_eq!(client.clock.get(peer).counter(), 42);

        Ok(())
    }

    #[test]
    fn test_merge_attr() -> Result<()> {
        let mut client = setup();

        let (pt, _) = client.create_feature(feature::Type::POINT)?;
        client.set_feature_attr(pt, "foo", AttrValue::None)?;
        client.set_feature_attr(pt, "foo", AttrValue::number(42.0))?;
        client.set_feature_attr(pt, "foo", AttrValue::string("bar"))?;

        let actual = client
            .feature_attrs(pt)
            .unwrap()
            .map(|(k, v)| (k.to_string(), v.clone()))
            .collect::<Vec<_>>();

        assert_eq!(actual, vec![("foo".to_string(), AttrValue::string("bar"))]);

        Ok(())
    }

    #[test]
    fn test_unseen_all() -> Result<()> {
        let mut client = setup();
        let peer = ClientId(2);

        let (group, create_group) = client.create_feature(feature::Type::GROUP)?;
        let (pt1, create_pt1) = client.create_feature(feature::Type::POINT)?;
        let (pt2, create_pt2) = client.create_feature(feature::Type::POINT)?;
        let (pt3, create_pt3) = client.create_feature(feature::Type::POINT)?;
        dbg!(group);
        dbg!(pt1);
        dbg!(pt2);
        dbg!(pt3);

        // An outdated op that will be ignored
        client.move_feature(pt1, feature::Id::ROOT, None, None)?;

        let pt1_move = client.move_feature(pt1, group, None, None)?;
        let pt1_idx = match &pt1_move.action {
            op::Action::MoveFeature { at: Some(at), .. } => at.idx.clone(),
            _ => unreachable!(),
        };

        let pt3_move = Op::new(
            LInstant::new(peer, pt1_move.ts.counter() + 1),
            op::Action::MoveFeature {
                id: pt3,
                at: Some(group / FracIdx::between(Some(&pt1_idx), None, &mut client.rng)),
            },
        );
        client.apply(pt3_move.clone());

        let pt2_move = client.move_feature(pt2, group, Some(pt1), Some(pt3))?;

        let (group2, _) = client.create_feature(feature::Type::GROUP)?;
        let group2_delete = client.delete_feature(group2)?;

        let actual = client.unseen_by(&VClock::new());

        assert_eq!(
            actual,
            vec![
                create_group,
                create_pt1,
                create_pt2,
                create_pt3,
                pt1_move,
                pt3_move,
                pt2_move,
                group2_delete
            ]
        );

        Ok(())
    }
}

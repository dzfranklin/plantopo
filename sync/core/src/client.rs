use crate::{
    aware_capnp, capnp_support::*, delta::LayerDelta, delta_capnp, prelude::*, save_capnp,
    sync_capnp,
};

#[derive(Debug)]
pub struct Client {
    id: ClientId,
    map_id: MapId,
    rng: RngType,
    clock: LClock,
    features: feature::Store,
    layers: layer::Store,
    aware: aware::Store,
    attrs: attr::Store,
}

impl Client {
    pub fn new(id: ClientId, map_id: MapId, rng: RngType) -> Self {
        Self {
            id,
            map_id,
            rng,
            clock: LClock::new(id, 1),
            features: Default::default(),
            layers: Default::default(),
            aware: aware::Store::new(id),
            attrs: Default::default(),
        }
    }

    pub fn id(&self) -> ClientId {
        self.id
    }

    pub fn map_id(&self) -> MapId {
        self.map_id
    }

    pub fn now(&self) -> LInstant {
        self.clock.now()
    }

    #[tracing::instrument(skip_all)]
    pub fn merge(&mut self, delta: delta_capnp::delta::Reader) -> Result<()> {
        self.layers.merge(&mut self.clock, &delta.get_layers()?)?;
        self.features
            .merge(&mut self.clock, &delta.get_features()?)?;
        self.attrs.merge(&mut self.clock, &delta.get_attrs()?)?;
        self.clock.tick();
        Ok(())
    }

    #[tracing::instrument(skip_all)]
    pub fn merge_aware(&mut self, aware: &[(ClientId, Option<Aware>)]) {
        self.aware.merge(aware);
        self.clock.tick();
    }

    #[tracing::instrument(skip_all)]
    pub fn save(&self, mut b: save_capnp::save::Builder) {
        b.set_client_id(self.id.into());
        write_uuid(b.reborrow().init_map_id(), self.map_id.into());

        let delta = self.write_state();
        delta.write(b.init_state());
    }

    pub fn write_my_aware(&self, out: &mut Vec<(ClientId, Option<Aware>)>) {
        let entry = self.aware.get_my().clone();
        out.push((self.id(), Some(entry)));
    }

    pub fn write_aware(&self, out: &mut Delta) {
        self.aware.save(out);
    }

    #[tracing::instrument(skip_all)]
    pub fn restore(save: save_capnp::save::Reader, rng: RngType) -> Result<Self> {
        let id: ClientId = save.get_client_id().into();
        let map_id: MapId = read_uuid(save.get_map_id()?).into();
        let mut client = Self::new(id, map_id, rng);
        client.merge(save.get_state()?)?;
        Ok(client)
    }

    pub fn write_state(&self) -> Delta {
        let mut delta = Delta::new(Some(self.now()));
        self.layers.save(&mut delta);
        self.features.save(&mut delta);
        self.attrs.save(&mut delta.attrs);
        delta
    }

    pub fn aware(&self) -> &aware::Store {
        &self.aware
    }

    pub fn aware_mut(&mut self) -> &mut aware::Store {
        &mut self.aware
    }

    pub fn set_aware(
        &mut self,
        out: &mut Vec<(ClientId, Option<Aware>)>,
        client: ClientId,
        value: Option<Aware>,
    ) {
        out.push((client, value));
        self.aware.merge(&out);
    }

    pub fn attrs(&self) -> &attr::Store {
        &self.attrs
    }

    pub fn attrs_mut(&mut self) -> &mut attr::Store {
        &mut self.attrs
    }

    #[tracing::instrument(skip(self))]
    pub fn set_attr(&mut self, out: &mut Delta, key: attr::Key, value: attr::Value) {
        out.attrs.push((key, LwwReg::new(value, self.clock.now())));
        self.clock.tick();
    }

    pub fn layers(&self) -> &layer::Store {
        &self.layers
    }

    pub fn layers_mut(&mut self) -> &mut layer::Store {
        &mut self.layers
    }

    #[tracing::instrument(skip(self))]
    pub fn set_layer_attr(
        &mut self,
        out: &mut Delta,
        id: layer::Id,
        key: attr::Key,
        value: attr::Value,
    ) {
        out.layers.push(LayerDelta {
            attrs: vec![(key, LwwReg::new(value, self.clock.now()))],
            ..LayerDelta::new(id)
        });
        self.clock.tick();
    }

    /// Note that all layers implicitly exist for all time.
    #[tracing::instrument(skip(self))]
    pub fn move_layer(
        &mut self,
        out: &mut Delta,
        id: layer::Id,
        before: Option<layer::Id>,
        after: Option<layer::Id>,
    ) -> Result<()> {
        let before_idx = if let Some(before) = before {
            self.layers.get_at(&before).wrap_err("get before")?
        } else {
            None
        };
        let after_idx = if let Some(after) = after {
            self.layers.get_at(&after).wrap_err("get after")?
        } else {
            None
        };

        let idx = FracIdx::between(before_idx, after_idx, &mut self.rng);
        tracing::trace!(?idx, ?before_idx, ?after_idx);

        out.layers.push(LayerDelta {
            at: LwwReg::new(Some(idx), self.clock.now()),
            ..LayerDelta::new(id)
        });
        self.clock.tick();
        Ok(())
    }

    #[tracing::instrument(skip(self))]
    pub fn remove_layer(&mut self, out: &mut Delta, id: layer::Id) -> Result<()> {
        if !self.layers.contains(&id) {
            return Err("layer to remove not found".into());
        }

        out.layers.push(LayerDelta {
            at: LwwReg::new(None, self.clock.now()),
            ..LayerDelta::new(id)
        });
        self.clock.tick();
        Ok(())
    }

    pub fn features(&self) -> &feature::Store {
        &self.features
    }

    pub fn features_mut(&mut self) -> &mut feature::Store {
        &mut self.features
    }

    #[tracing::instrument(skip(self))]
    pub fn create_group(&mut self, out: &mut Delta) -> Result<feature::Id> {
        let id = feature::Id(self.clock.now());
        let at = self.insert_point();

        // TODO: Repeated pushes to aware won't be combined properly
        out.aware.push()

        // let mut parts = out.init_parts(3);

        // {
        //     let mut b = parts.reborrow().get(0).init_aware();
        //     self.set_aware(
        //         b.reborrow(),
        //         self.id,
        //         Some(&Aware {
        //             active_features: smallvec![id],
        //             ..self.aware.get_my().clone()
        //         }),
        //     )?;
        //     self.merge_aware(b.reborrow_as_reader())?;
        // }

        // {
        //     let mut b = parts.reborrow().get(1).init_delta();
        //     self.create_feature(b.reborrow(), feature::Type::GROUP)?;
        //     self.merge(b.reborrow_as_reader())?;
        // }

        // {
        //     let mut b = parts.get(1).init_delta();
        //     self.move_feature_to(b.reborrow(), id, at)?;
        //     self.merge(b.reborrow_as_reader())?;
        // }
        todo!();

        Ok(id)
    }

    fn insert_point(&mut self) -> feature::At {
        let mut parent = feature::Id::ROOT;
        let mut before = None;
        let mut after = None;
        if let Some(active) = self.aware.get_my().active_features.first().cloned() {
            if self.features.ty(active).ok() == Some(feature::Type::GROUP) {
                parent = active;
                before = None;
                after = self.features.first_child(active);
            } else {
                parent = self.features.parent(active).unwrap_or(feature::Id::ROOT);
                before = Some(active);
                after = self.features.next_sibling(active);
            }
        }

        let before = before
            .and_then(|id| self.features.at(id).ok().flatten())
            .map(|at| &at.idx);
        let after = after
            .and_then(|id| self.features.at(id).ok().flatten())
            .map(|at| &at.idx);

        let idx = FracIdx::between(before, after, &mut self.rng);
        feature::At { parent, idx }
    }

    #[tracing::instrument(skip(self, out))]
    pub fn create_feature(
        &mut self,
        mut out: delta_capnp::delta::Builder,
        ty: feature::Type,
    ) -> Result<feature::Id> {
        let id = feature::Id(self.clock.now());

        // Serialize
        write_l_instant(out.reborrow().init_ts(), self.clock.now());
        let mut b = out.reborrow().init_features().init_live(1).get(0);
        write_l_instant(b.reborrow().init_id(), id.into());
        b.set_type(ty.into());

        self.merge(out.reborrow_as_reader())?;
        Ok(id)
    }

    #[tracing::instrument(skip(self, out))]
    pub fn set_feature_attr(
        &mut self,
        mut out: delta_capnp::delta::Builder,
        id: feature::Id,
        key: &attr::Key,
        value: &attr::Value,
    ) -> Result<()> {
        let ty = self.features.ty(id)?;

        // Serialize
        write_l_instant(out.reborrow().init_ts(), self.clock.now());
        let mut b = out.reborrow().init_features().init_live(1).get(0);
        write_l_instant(b.reborrow().init_id(), id.into());
        b.set_type(ty.into());
        write_attr(
            b.init_attrs().init_value(1).get(0),
            key,
            value,
            self.clock.now(),
        );

        self.merge(out.reborrow_as_reader())
    }

    /// Write a delta corresponding to the  move.
    #[tracing::instrument(skip(self, out))]
    pub fn move_features(
        &mut self,
        mut out: delta_capnp::delta::Builder,
        ids: &[feature::Id],
        parent: feature::Id,
        before: Option<feature::Id>,
        after: Option<feature::Id>,
    ) -> Result<()> {
        let before = if let Some(before) = before {
            self.features
                .at(before)
                .wrap_err("move_feature: get before")?
        } else {
            None
        };
        let after = if let Some(after) = after {
            self.features
                .at(after)
                .wrap_err("move_feature: get after")?
        } else {
            None
        };
        let before = if let Some(at) = before {
            if at.parent == parent {
                Some(at.idx.clone())
            } else {
                return Err("move_feature: before parent mismatch".into());
            }
        } else {
            None
        };
        let after = if let Some(at) = after {
            if at.parent == parent {
                Some(&at.idx)
            } else {
                return Err("move_feature: after parent mismatch".into());
            }
        } else {
            None
        };

        write_l_instant(out.reborrow().init_ts(), self.clock.now());
        let mut live = out.reborrow().init_features().init_live(ids.len() as u32);

        let mut before = before;
        for (i, &id) in ids.into_iter().enumerate() {
            let ty = self.features.ty(id)?;

            let idx = FracIdx::between(before.as_ref(), after, &mut self.rng);

            let mut b = live.reborrow().get(i as u32);
            write_l_instant(b.reborrow().init_id(), id.into());
            b.set_type(ty.into());

            write_frac_idx(b.reborrow().init_at_idx(), &idx);
            write_l_instant(b.reborrow().init_at_parent(), parent.into());
            write_l_instant(b.reborrow().init_at_ts(), self.clock.now());

            before = Some(idx);
        }

        self.merge(out.reborrow_as_reader())
    }

    fn move_feature_to(
        &mut self,
        mut out: delta_capnp::delta::Builder,
        id: feature::Id,
        at: feature::At,
    ) -> Result<()> {
        let ty = self.features.ty(id)?;

        write_l_instant(out.reborrow().init_ts(), self.clock.now());

        let mut b = out.reborrow().init_features().init_live(1).get(0);
        write_l_instant(b.reborrow().init_id(), id.into());
        b.set_type(ty.into());

        write_frac_idx(b.reborrow().init_at_idx(), &at.idx);
        write_l_instant(b.reborrow().init_at_parent(), at.parent.into());
        write_l_instant(b.reborrow().init_at_ts(), self.clock.now());

        Ok(())
    }

    /// Irreversible
    #[tracing::instrument(skip(self, out))]
    pub fn delete_feature(
        &mut self,
        mut out: delta_capnp::delta::Builder,
        id: feature::Id,
    ) -> Result<()> {
        if !self.features.contains(id) {
            return Err("feature to delete not found".into());
        }

        // Serialize
        write_l_instant(out.reborrow().init_ts(), self.clock.now());
        let mut b = out.reborrow().init_features().init_dead(1).get(0);
        write_l_instant(b.reborrow().init_id(), id.into());

        self.merge(out.reborrow_as_reader())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use capnp::message::TypedBuilder;
    use eyre::Result;
    #[allow(unused)]
    use pretty_assertions::{assert_eq, assert_ne};
    use tracing_subscriber::prelude::*;

    type DeltaBuilder = TypedBuilder<delta_capnp::delta::Owned>;

    fn setup() -> Client {
        static ONCE: std::sync::Once = std::sync::Once::new();
        ONCE.call_once(|| {
            color_eyre::install().unwrap();
            tracing_subscriber::registry()
                .with(
                    tracing_subscriber::EnvFilter::try_from_default_env()
                        .unwrap_or_else(|_| "plantopo_sync_core=info".into()),
                )
                .with(
                    tracing_subscriber::fmt::layer()
                        .with_file(true)
                        .with_line_number(true),
                )
                .init()
        });
        let id = ClientId(1);
        let map_id = MapId(Uuid::from_str("a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d").unwrap());
        let rng = RngType::from_seed([
            0x74, 0xe3, 0xb8, 0x20, 0x82, 0x4f, 0xb1, 0x76, 0x87, 0xcd, 0xf, 0xbb, 0x25, 0x61,
            0xa0, 0x6a, 0xf9, 0x2a, 0x50, 0x98, 0x6c, 0x6e, 0xeb, 0x5d, 0xce, 0xe, 0xa1, 0x36,
            0x5a, 0x93, 0x22, 0xcc,
        ]);
        Client::new(id, map_id, rng)
    }

    fn setup_peer() -> Client {
        let id = ClientId(2);
        let map_id = MapId(Uuid::from_str("a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d").unwrap());
        let rng = RngType::from_seed([
            0x8e, 0x0c, 0x31, 0x45, 0x5c, 0xa8, 0x80, 0x17, 0xb0, 0xa6, 0x04, 0x49, 0xd0, 0xcc,
            0x67, 0x22, 0x4c, 0xb6, 0x46, 0x9f, 0xb1, 0x85, 0xda, 0x8b, 0xed, 0xbc, 0x9f, 0xd7,
            0xf0, 0xf4, 0x75, 0xb6,
        ]);
        Client::new(id, map_id, rng)
    }

    #[test]
    fn test_threadsafe() {
        fn is_send<T: Send>() {}
        fn is_sync<T: Sync>() {}
        is_send::<Client>();
        is_sync::<Client>();
    }

    #[test]
    fn test_create_delete_feature() -> Result<()> {
        let mut client = setup();
        let mut b = DeltaBuilder::new_default();

        let pt = client.create_feature(b.init_root(), feature::Type::POINT)?;
        client.delete_feature(b.init_root(), pt)?;
        assert!(client.delete_feature(b.init_root(), pt).is_err());
        Ok(())
    }

    #[test]
    fn test_move_remove_layer() -> Result<()> {
        let mut client = setup();
        let mut b = DeltaBuilder::new_default();
        let l1 = layer::Id::from_str("a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d")?;
        let l2 = layer::Id::from_str("b2c3d4e5-f6a7-8b9c-0d1e-2f3a4b5c6d7e")?;

        // Cannot remove layer without at
        assert!(client.remove_layer(b.init_root(), l1).is_err());

        client.move_layer(b.init_root(), l1, None, None)?;
        assert_eq!(vec![l1], client.layers.order().collect::<Vec<_>>());

        client.move_layer(b.init_root(), l2, None, Some(l1))?;
        assert_eq!(vec![l2, l1], client.layers.order().collect::<Vec<_>>());

        client.move_layer(b.init_root(), l2, Some(l1), None)?;
        assert_eq!(vec![l1, l2], client.layers.order().collect::<Vec<_>>());

        client.remove_layer(b.init_root(), l1)?;
        assert_eq!(vec![l2], client.layers.order().collect::<Vec<_>>());

        client.remove_layer(b.init_root(), l2)?;
        assert_eq!(0, client.layers.order().len());

        Ok(())
    }

    #[test]
    fn test_move_feature_to_middle() -> Result<()> {
        let mut client = setup();
        let mut b = DeltaBuilder::new_default();

        let group1 = client.create_feature(b.init_root(), feature::Type::GROUP)?;
        let pt = client.create_feature(b.init_root(), feature::Type::POINT)?;

        let expected = client.features.child_order(group1).unwrap().next();
        assert!(expected.is_none());

        client.move_features(b.init_root(), &[pt], group1, None, None)?;

        let actual = client
            .features
            .child_order(group1)
            .unwrap()
            .map(|(id, _ty)| id)
            .collect::<Vec<_>>();
        assert_eq!(vec![pt], actual);

        let group2 = client.create_feature(b.init_root(), feature::Type::GROUP)?;

        client.move_features(b.init_root(), &[pt], group2, None, None)?;

        let expected = client.features.child_order(group1).unwrap().next();
        assert!(expected.is_none());

        let actual = client
            .features
            .child_order(group2)
            .unwrap()
            .map(|(id, _ty)| id)
            .collect::<Vec<_>>();
        assert_eq!(vec![pt], actual);

        Ok(())
    }

    #[test]
    fn test_move_layer_to_middle() -> Result<()> {
        let mut client = setup();
        let mut b = DeltaBuilder::new_default();
        let layer = layer::Id::from_str("a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d")?;

        assert_eq!(0, client.layers.order().len());

        client.move_layer(b.init_root(), layer, None, None)?;

        let actual = client.layers.order().collect::<Vec<_>>();
        assert_eq!(vec![layer], actual);

        Ok(())
    }

    #[test]
    fn test_move_between() -> Result<()> {
        let mut client = setup();
        let mut b = DeltaBuilder::new_default();

        let group = client.create_feature(b.init_root(), feature::Type::GROUP)?;
        let pt1 = client.create_feature(b.init_root(), feature::Type::POINT)?;
        let pt2 = client.create_feature(b.init_root(), feature::Type::POINT)?;
        let pt3 = client.create_feature(b.init_root(), feature::Type::POINT)?;

        client.move_features(b.init_root(), &[pt1], group, None, None)?;
        client.move_features(b.init_root(), &[pt3], group, Some(pt1), None)?;
        client.move_features(b.init_root(), &[pt2], group, Some(pt1), Some(pt3))?;

        let actual = client
            .features
            .child_order(group)
            .unwrap()
            .map(|(id, _ty)| id)
            .collect::<Vec<_>>();
        assert_eq!(vec![pt1, pt2, pt3], actual);

        Ok(())
    }

    #[test]
    fn test_apply_merges_clock() -> Result<()> {
        let mut client = setup();
        let mut peer = setup_peer();
        let mut b = DeltaBuilder::new_default();

        assert_eq!(0x1, client.now().counter);

        peer.clock.observe(LInstant::new(peer.id, 0x10));
        assert_eq!(0x10, peer.now().counter);

        let mut delta1 = b.init_root();
        let create_ts = peer.now();
        let feat = peer.create_feature(delta1.reborrow(), feature::Type::GROUP)?;
        assert_eq!(0x10, create_ts.counter);

        client.merge(delta1.reborrow_as_reader())?;
        assert_eq!((create_ts + 1).counter, client.now().counter);

        let mut delta2 = b.init_root();
        let delete_ts = peer.now();
        peer.delete_feature(delta2.reborrow(), feat)?;
        assert_eq!(create_ts + 1, delete_ts);

        client.merge(delta2.reborrow_as_reader())?;
        assert_eq!((delete_ts + 1).counter, client.now().counter);

        Ok(())
    }

    #[test]
    fn test_merge_attr() -> Result<()> {
        let mut client = setup();
        let mut b = DeltaBuilder::new_default();

        let pt = client.create_feature(b.init_root(), feature::Type::POINT)?;
        let key = attr::Key("foo".into());

        client.set_feature_attr(b.init_root(), pt, &key, &attr::Value::None)?;
        client.set_feature_attr(b.init_root(), pt, &key, &attr::Value::number(42.0))?;
        client.set_feature_attr(b.init_root(), pt, &key, &attr::Value::string("bar"))?;

        let actual = client
            .features
            .attrs(pt)
            .unwrap()
            .iter()
            .map(|(k, v)| (k, v.clone()))
            .collect::<Vec<_>>();

        assert_eq!(actual, vec![(&key, attr::Value::string("bar"))]);

        Ok(())
    }
}

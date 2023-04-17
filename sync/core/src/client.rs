use crate::{capnp_support::*, delta_capnp, prelude::*, save_capnp};

#[derive(Debug)]
pub struct Client {
    id: ClientId,
    map_id: MapId,
    rng: RngType,
    clock: LClock,
    features: feature::Store,
    layers: layer::Store,
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
        self.clock.tick();
        Ok(())
    }

    #[tracing::instrument(skip_all)]
    pub fn save(&self, mut b: save_capnp::save::Builder) {
        b.set_client_id(self.id.into());
        write_uuid(b.reborrow().init_map_id(), self.map_id.into());
        self.write_state(b.reborrow().init_state());
    }

    #[tracing::instrument(skip_all)]
    pub fn restore(save: save_capnp::save::Reader, rng: RngType) -> Result<Self> {
        let id: ClientId = save.get_client_id().into();
        let map_id: MapId = read_uuid(save.get_map_id()?).into();
        let mut client = Self::new(id, map_id, rng);
        client.merge(save.get_state()?)?;
        Ok(client)
    }

    pub fn write_state(&self, mut b: delta_capnp::delta::Builder) {
        self.layers.save(b.reborrow().init_layers());
        self.features.save(b.init_features());
    }

    pub fn layer_order(&self) -> layer::OrderIter {
        self.layers.order()
    }

    pub fn layer_attrs(&self, id: &layer::Id) -> Option<attr::Iter> {
        self.layers.attrs(id)
    }

    #[tracing::instrument(skip(self, out))]
    pub fn set_layer_attr(
        &mut self,
        mut out: delta_capnp::delta::Builder,
        id: layer::Id,
        key: attr::Key,
        value: attr::Value,
    ) -> Result<()> {
        if !self.layers.contains(&id) {
            return Err("layer to set attr on not found".into());
        }

        // Serialize
        let mut b = out.reborrow().init_layers().init_value(1).get(0);
        write_uuid(b.reborrow().init_id(), id.into());
        write_attr(
            b.init_attrs().init_value(1).get(0),
            key,
            &value,
            self.clock.now(),
        );

        self.merge(out.reborrow_as_reader())
    }

    /// Note that all layers implicitly exist for all time.
    #[tracing::instrument(skip(self, out))]
    pub fn move_layer(
        &mut self,
        mut out: delta_capnp::delta::Builder,
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

        // Serialize
        let mut b = out.reborrow().init_layers().init_value(1).get(0);
        write_uuid(b.reborrow().init_id(), id.into());
        write_frac_idx(b.reborrow().init_at(), &idx);
        write_l_instant(b.init_at_ts(), self.clock.now());

        self.merge(out.reborrow_as_reader())
    }

    #[tracing::instrument(skip(self, out))]
    pub fn remove_layer(
        &mut self,
        mut out: delta_capnp::delta::Builder,
        id: layer::Id,
    ) -> Result<()> {
        if !self.layers.contains(&id) {
            return Err("layer to remove not found".into());
        }

        // Serialize
        let mut b = out.reborrow().init_layers().init_value(1).get(0);
        write_uuid(b.reborrow().init_id(), id.into());
        write_l_instant(b.init_at_ts(), self.clock.now());

        self.merge(out.reborrow_as_reader())
    }

    pub fn feature_order(&self, parent: feature::Id) -> Option<feature::OrderIter> {
        self.features.order(parent)
    }

    pub fn feature_ty(&self, feature: feature::Id) -> Option<feature::Type> {
        self.features.ty(feature)
    }

    pub fn feature_attrs(&self, feature: feature::Id) -> Option<attr::Iter> {
        self.features.attrs(feature)
    }

    #[tracing::instrument(skip(self, out))]
    pub fn create_feature(
        &mut self,
        mut out: delta_capnp::delta::Builder,
        ty: feature::Type,
    ) -> Result<feature::Id> {
        let id = feature::Id(self.clock.now());

        // Serialize
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
        key: attr::Key,
        value: attr::Value,
    ) -> Result<()> {
        let ty = self
            .feature_ty(id)
            .ok_or("feature to set attr on not found")?;

        // Serialize
        let mut b = out.reborrow().init_features().init_live(1).get(0);
        write_l_instant(b.reborrow().init_id(), id.into());
        b.set_type(ty.into());
        write_attr(
            b.init_attrs().init_value(1).get(0),
            key,
            &value,
            self.clock.now(),
        );

        self.merge(out.reborrow_as_reader())
    }

    /// Write a delta corresponding to the  move.
    #[tracing::instrument(skip(self, out))]
    pub fn move_feature(
        &mut self,
        mut out: delta_capnp::delta::Builder,
        id: feature::Id,
        parent: feature::Id,
        before: Option<feature::Id>,
        after: Option<feature::Id>,
    ) -> Result<()> {
        // Compute

        let ty = self.features.ty(id).ok_or("feature to move not found")?;

        let before_at = if let Some(before) = before {
            self.features
                .at(before)
                .wrap_err("move_feature: get before")?
        } else {
            None
        };

        let after_at = if let Some(after) = after {
            self.features
                .at(after)
                .wrap_err("move_feature: get after")?
        } else {
            None
        };

        if let Some(before_at) = before_at {
            if before_at.parent != parent {
                return Err("move_feature: before parent mismatch".into());
            }
        }
        if let Some(after_at) = after_at {
            if after_at.parent != parent {
                return Err("move_feature: after parent mismatch".into());
            }
        }

        let idx = FracIdx::between(
            before_at.map(|at| &at.idx),
            after_at.map(|at| &at.idx),
            &mut self.rng,
        );

        // Serialize

        let mut b = out.reborrow().init_features().init_live(1).get(0);
        write_l_instant(b.reborrow().init_id(), id.into());
        b.set_type(ty.into());

        write_frac_idx(b.reborrow().init_at_idx(), &idx.into());
        write_l_instant(b.reborrow().init_at_parent(), parent.into());
        write_l_instant(b.reborrow().init_at_ts(), self.clock.now());

        self.merge(out.reborrow_as_reader())
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
        assert_eq!(vec![l1], client.layer_order().collect::<Vec<_>>());

        client.move_layer(b.init_root(), l2, None, Some(l1))?;
        assert_eq!(vec![l2, l1], client.layer_order().collect::<Vec<_>>());

        client.move_layer(b.init_root(), l2, Some(l1), None)?;
        assert_eq!(vec![l1, l2], client.layer_order().collect::<Vec<_>>());

        client.remove_layer(b.init_root(), l1)?;
        assert_eq!(vec![l2], client.layer_order().collect::<Vec<_>>());

        client.remove_layer(b.init_root(), l2)?;
        assert_eq!(0, client.layer_order().len());

        Ok(())
    }

    #[test]
    fn test_move_feature_to_middle() -> Result<()> {
        let mut client = setup();
        let mut b = DeltaBuilder::new_default();

        let group1 = client.create_feature(b.init_root(), feature::Type::GROUP)?;
        let pt = client.create_feature(b.init_root(), feature::Type::POINT)?;

        assert!(client.feature_order(group1).unwrap().next().is_none());

        client.move_feature(b.init_root(), pt, group1, None, None)?;

        let actual = client.feature_order(group1).unwrap().collect::<Vec<_>>();
        assert_eq!(vec![pt], actual);

        let group2 = client.create_feature(b.init_root(), feature::Type::GROUP)?;

        client.move_feature(b.init_root(), pt, group2, None, None)?;

        assert!(client.feature_order(group1).unwrap().next().is_none());

        let actual = client.feature_order(group2).unwrap().collect::<Vec<_>>();
        assert_eq!(vec![pt], actual);

        Ok(())
    }

    #[test]
    fn test_move_layer_to_middle() -> Result<()> {
        let mut client = setup();
        let mut b = DeltaBuilder::new_default();
        let layer = layer::Id::from_str("a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d")?;

        assert_eq!(0, client.layer_order().len());

        client.move_layer(b.init_root(), layer, None, None)?;

        let actual = client.layer_order().collect::<Vec<_>>();
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

        client.move_feature(b.init_root(), pt1, group, None, None)?;
        client.move_feature(b.init_root(), pt3, group, Some(pt1), None)?;
        client.move_feature(b.init_root(), pt2, group, Some(pt1), Some(pt3))?;

        let actual = client.feature_order(group).unwrap().collect::<Vec<_>>();
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
        let key = attr::Key(0x1);

        client.set_feature_attr(b.init_root(), pt, key, attr::Value::None)?;
        client.set_feature_attr(b.init_root(), pt, key, attr::Value::number(42.0))?;
        client.set_feature_attr(b.init_root(), pt, key, attr::Value::string("bar"))?;

        let actual = client
            .feature_attrs(pt)
            .unwrap()
            .map(|(k, v)| (k, v.clone()))
            .collect::<Vec<_>>();

        assert_eq!(actual, vec![(key, attr::Value::string("bar"))]);

        Ok(())
    }
}

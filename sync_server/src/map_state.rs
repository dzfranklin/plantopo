use std::collections::{BTreeMap, HashMap, HashSet};

use capnp::message::TypedBuilder;
use compact_str::CompactString;
use eyre::{eyre, Result};
use rand::{rngs::SmallRng, SeedableRng};
use uuid::Uuid;

use plantopo_schema::{
    core_capnp::reg,
    map_capnp::{feature, layer},
    prelude::*,
};

#[derive(Debug)]
pub struct MapState {
    id: Uuid,
    rng: SmallRng,
    clock: LClock,
    last_updated: PInstant,
    name: TypedBuilder<reg::Owned<capnp::text::Owned>>,
    aware: HashMap<ClientId, Aware>,
    authenticated: HashMap<ClientId, VerifiedUserMeta>,
    layers: HashMap<LayerId, TypedBuilder<layer::Owned>>,
    layer_order: BTreeMap<CompactString, LayerId>,
    live_features: HashMap<FeatureId, TypedBuilder<feature::Owned>>,
    dead_features: HashSet<FeatureId>,
    feature_order: HashMap<FeatureId, BTreeMap<CompactString, FeatureId>>,
}

#[derive(Debug, Default)]
struct Aware {
    received: PInstant,
    entry: TypedBuilder<map_capnp::aware::entry::Owned>,
}

#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct VerifiedUserMeta {
    pub id: Uuid,
    pub username: String,
}

#[derive(Debug)]
pub struct Fixups {
    pub move_layer: HashMap<LayerId, CompactString>,
    pub move_feature: HashMap<FeatureId, (FeatureId, CompactString)>,
}

macro_rules! merge {
    ($our:expr, $other:expr) => {{
        let mut our = $our;
        let other = $other;
        if other.get_ts() > our.reborrow().get_ts() {
            our.copy_from(&other)?;
            true
        } else {
            false
        }
    }};
}

impl MapState {
    pub fn new(id: Uuid, me: ClientId) -> Self {
        let mut name = TypedBuilder::new_default();
        name.init_root();

        Self {
            id,
            clock: LClock::new(me),
            rng: SmallRng::from_entropy(),
            last_updated: PInstant::default(),
            name,
            aware: HashMap::default(),
            authenticated: HashMap::default(),
            layers: HashMap::default(),
            layer_order: BTreeMap::default(),
            live_features: HashMap::default(),
            dead_features: HashSet::default(),
            feature_order: HashMap::default(),
        }
    }

    pub fn now(&self) -> LInstant {
        self.clock.inner()
    }

    pub fn authenticate(&mut self, client: ClientId, user: VerifiedUserMeta) {
        self.authenticated.insert(client, user);
    }

    pub fn disconnect(&mut self, client: ClientId) {
        self.aware.remove(&client);
        self.authenticated.remove(&client);
    }

    #[tracing::instrument]
    pub fn save(
        &self,
        mut builder: map_capnp::map::Builder<'_>,
        include_aware: bool,
    ) -> Result<()> {
        // Metadata

        builder.reborrow().init_id().set_uuid(self.id);
        builder.set_full(true);
        builder.set_last_updated(self.last_updated.inner());
        builder.set_clock(self.clock.now());

        builder.set_name(self.name.get_root_as_reader()?)?;

        // Aware

        if include_aware {
            let mut b = builder.reborrow().init_aware(self.aware.len() as u32);
            for (i, (client, aware)) in self.aware.iter().enumerate() {
                let mut b = b.reborrow().get(i as u32);

                if let Some(user) = self.authenticated.get(&client) {
                    let mut b = b.reborrow().init_auth();
                    b.reborrow().init_user().set_uuid(user.id);
                    b.set_username(&user.username);
                }

                b.set_entry(aware.entry.get_root_as_reader()?)?;
            }
        }

        // Layers

        let mut b = builder.reborrow().init_layers(self.layers.len() as u32);
        for (i, layer) in self.layers.values().enumerate() {
            let layer = layer.get_root_as_reader()?;
            b.reborrow().get(i as u32).copy_from(&layer)?;
        }

        // Features

        let mut b = builder.reborrow().init_features();

        let mut dead_b = b.reborrow().init_dead(self.dead_features.len() as u32);
        for (i, id) in self.dead_features.iter().enumerate() {
            dead_b.reborrow().set(i as u32, id.inner());
        }

        let mut live_b = b.reborrow().init_live(self.live_features.len() as u32);
        for (i, feature) in self.live_features.values().enumerate() {
            let feature = feature.get_root_as_reader()?;
            live_b.reborrow().get(i as u32).copy_from(&feature)?;
        }

        Ok(())
    }

    #[tracing::instrument]
    pub fn merge(
        &mut self,
        client: ClientId,
        other: map_capnp::map::Reader<'_>,
        fixups: &mut Fixups,
    ) -> Result<()> {
        let mut to_traversal_check = HashSet::new();

        if self.id != other.get_id()?.as_uuid() {
            return Err(eyre!("map id mismatch"));
        }

        // Metadata

        self.clock.merge(other.get_clock())?;

        let other_last_updated = PInstant(other.get_last_updated());
        if other_last_updated > self.last_updated {
            self.last_updated = other_last_updated;
        }

        merge!(self.name.get_root()?, other.get_name()?);

        // Awareness

        for other in other.get_aware()? {
            let other_client = ClientId::new(other.get_client())?;
            if other_client != client {
                // We only use clients as a source of truth for their own awareness.
                continue;
            }

            let received = PInstant::now();

            // NOTE: We deliberately ignore updates the auth section as
            // `self.authenticated` is the authoritative source.

            let mut entry = TypedBuilder::new_default();
            entry.set_root(other.get_entry()?)?;

            self.aware.insert(other_client, Aware { received, entry });
        }

        // Layers

        for other in other.get_layers()? {
            let id = LayerId(other.get_id()?.as_uuid());

            let our = self.layers.entry(id).or_default();
            let mut our = if our.has_root() {
                our.get_root()?
            } else {
                let mut our = our.init_root();
                our.reborrow().init_id().set_uuid(id.inner());
                our
            };

            // Merge at
            let mut our_at = our.reborrow().get_at()?;
            let other_at = other.get_at()?;
            if other_at.get_ts() > our_at.reborrow().get_ts() {
                our_at.set_ts(other_at.get_ts());

                if our_at.has_value() {
                    // Remove the old value from prev.layer_order
                    let prev = our_at.reborrow_as_reader().get_value()?;
                    self.layer_order.remove(prev);
                }

                if other_at.has_value() {
                    let new = other_at.get_value()?;
                    frac_idx::validate(new)?;

                    if self.layer_order.contains_key(new) {
                        // The index collides and we need to fix it

                        let new = replace_dup_idx(&self.layer_order, new, &mut self.rng)?;
                        fixups.move_layer.insert(id, new.clone());

                        self.layer_order.insert(new.clone(), id);

                        self.clock.merge(our_at.reborrow().get_ts())?; // Make sure we'll override the existing value
                        our_at.set_ts(self.clock.now());
                        our_at.set_value(&new)?;
                    } else {
                        // Update ourselves with new the value
                        self.layer_order.insert(new.into(), id);
                        our_at.set_value(new)?;
                    }
                } else {
                    // Updated ourselves with the new value
                    our_at.clear_value();
                }
            }

            merge!(our.get_opacity()?, other.get_opacity()?);
        }

        // Features

        for other in other.get_features().get_dead()? {
            let other = FeatureId::new(other)?;
            self.dead_features.insert(other);
            self.live_features.remove(&other);
            self.feature_order.remove(&other);
        }

        for other in other.get_features().get_live()? {
            let id = FeatureId::new(other.get_id())?;
            if self.dead_features.contains(&id) {
                continue;
            }

            let our = self.live_features.entry(id).or_default();
            let mut our = if our.has_root() {
                our.get_root()?
            } else {
                let mut our = our.init_root();
                our.set_id(id.inner());
                our
            };

            // Merge at
            let mut our_at = our.reborrow().get_at()?;
            let other_at = other.get_at()?;
            if other_at.get_ts() > our_at.reborrow().get_ts() {
                our_at.reborrow().set_ts(other_at.get_ts());

                if our_at.has_value() {
                    // Remove the old value from self.feature_order
                    let prev_at = our_at.reborrow_as_reader().get_value()?;
                    let prev_parent = FeatureId::new(prev_at.get_parent())?;
                    let prev_idx = prev_at.get_idx()?;
                    self.feature_order
                        .entry(prev_parent)
                        .or_default()
                        .remove(prev_idx);
                }

                if other_at.has_value() {
                    let new = other_at.get_value()?;

                    let new_idx = new.get_idx()?;
                    frac_idx::validate(new_idx)?;

                    let new_parent = FeatureId::new(new.get_parent())?;
                    let parent_order = self.feature_order.entry(new_parent).or_default();

                    to_traversal_check.insert(id);

                    if parent_order.contains_key(new_idx) {
                        // The index collides and we need to fix it

                        let new_idx = replace_dup_idx(&parent_order, new_idx, &mut self.rng)?;
                        fixups
                            .move_feature
                            .insert(id, (new_parent, new_idx.clone()));

                        parent_order.insert(new_idx, id);

                        self.clock.merge(our_at.reborrow().get_ts())?; // Make sure we'll override the existing value
                        our_at.set_ts(self.clock.now());
                        our_at.set_value(other_at.get_value()?)?;
                    } else {
                        // Update ourselves with new the value
                        parent_order.insert(new_idx.into(), id);
                        our_at.set_value(new)?;
                    }
                } else {
                    // Updated ourselves with the new value
                    our_at.clear_value();
                }
            }

            merge!(our.reborrow().get_name()?, other.get_name()?);
            merge!(our.reborrow().get_details()?, other.get_details()?);
            merge!(our.reborrow().get_hidden()?, other.get_hidden()?);

            match (our.which()?, other.which()?) {
                (feature::Which::Group(our), feature::Which::Group(other)) => {
                    merge_point_style(our.get_point_style()?, other.get_point_style()?)?;
                }
                (feature::Which::Point(mut our), feature::Which::Point(other)) => {
                    merge!(our.reborrow().get_coords()?, other.get_coords()?);
                    merge_point_style(our.get_style()?, other.get_style()?)?;
                }
                (_, _) => {
                    tracing::warn!("feature type mismatch: {id:?}");
                }
            }
        }

        if !to_traversal_check.is_empty() {
            todo!()
        }

        Ok(())
    }
}

fn merge_point_style(
    mut our: style_capnp::point::Builder<'_>,
    other: style_capnp::point::Reader<'_>,
) -> eyre::Result<()> {
    // Icon paint
    merge!(our.reborrow().get_icon_color()?, other.get_icon_color()?);
    merge!(
        our.reborrow().get_icon_halo_blur()?,
        other.get_icon_halo_blur()?
    );
    merge!(
        our.reborrow().get_icon_halo_color()?,
        other.get_icon_halo_color()?
    );
    merge!(
        our.reborrow().get_icon_halo_width()?,
        other.get_icon_halo_width()?
    );
    merge!(
        our.reborrow().get_icon_opacity()?,
        other.get_icon_opacity()?
    );

    // Text paint
    merge!(our.reborrow().get_text_color()?, other.get_text_color()?);
    merge!(
        our.reborrow().get_text_halo_blur()?,
        other.get_text_halo_blur()?
    );
    merge!(
        our.reborrow().get_text_halo_color()?,
        other.get_text_halo_color()?
    );
    merge!(
        our.reborrow().get_text_halo_width()?,
        other.get_text_halo_width()?
    );
    merge!(
        our.reborrow().get_text_opacity()?,
        other.get_text_opacity()?
    );

    // Icon layout
    merge!(our.reborrow().get_icon_anchor()?, other.get_icon_anchor()?);
    merge!(our.reborrow().get_icon_image()?, other.get_icon_image()?);
    merge!(our.reborrow().get_icon_offset()?, other.get_icon_offset()?);
    merge!(our.reborrow().get_icon_size()?, other.get_icon_size()?);
    merge!(
        our.reborrow().get_icon_size_zoomed_out_multiplier()?,
        other.get_icon_size_zoomed_out_multiplier()?
    );

    // Text layout
    merge!(our.reborrow().get_text_anchor()?, other.get_text_anchor()?);
    merge!(our.reborrow().get_text_font()?, other.get_text_font()?);
    merge!(
        our.reborrow().get_text_justify_reg()?,
        other.get_text_justify_reg()?
    );
    merge!(
        our.reborrow().get_text_letter_spacing()?,
        other.get_text_letter_spacing()?
    );
    merge!(
        our.reborrow().get_text_max_width()?,
        other.get_text_max_width()?
    );
    merge!(our.reborrow().get_text_offset()?, other.get_text_offset()?);
    merge!(our.reborrow().get_text_rotate()?, other.get_text_rotate()?);
    merge!(our.reborrow().get_text_size()?, other.get_text_size()?);

    Ok(())
}

fn replace_dup_idx<IdType>(
    order: &BTreeMap<CompactString, IdType>,
    desired: &str,
    rng: &mut SmallRng,
) -> eyre::Result<CompactString> {
    let mut after = CompactString::new("");
    let mut reached_conflict = false;
    for (sibling, _) in order.iter() {
        if !reached_conflict && sibling == &desired {
            reached_conflict = true;
        } else if reached_conflict && sibling != &desired {
            after = sibling.clone();
            break;
        }
    }
    let new = frac_idx::between(desired, &after, rng)?;
    assert!(!order.contains_key(&new));
    Ok(new)
}

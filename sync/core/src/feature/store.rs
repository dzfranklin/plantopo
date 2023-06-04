use super::*;
use crate::{capnp_support::*, delta::FeatureDelta, delta_capnp::delta::feature_store, prelude::*};

// TODO: Fix loops & orphans

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Store {
    dirty: bool,
    live: HashMap<Id, Feature>,
    dead: HashSet<Id>,
    order: HashMap<Id, SmallVec<[OrderEntry; 8]>>,
    linear_idx: HashMap<Id, u32>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
struct OrderEntry {
    id: Id,
    ty: feature::Type,
    idx: FracIdx,
}

impl PartialOrd for OrderEntry {
    fn partial_cmp(&self, other: &Self) -> Option<cmp::Ordering> {
        Some(self.cmp(other))
    }
}

impl Ord for OrderEntry {
    fn cmp(&self, other: &Self) -> cmp::Ordering {
        match self.idx.cmp(&other.idx) {
            cmp::Ordering::Equal => self.id.cmp(&other.id),
            ord => ord,
        }
    }
}

#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct Feature {
    ty: feature::Type,
    at: LwwReg<Option<At>>,
    attrs: attr::Store,
}

impl Default for Store {
    fn default() -> Self {
        let mut order = HashMap::new();
        order.insert(feature::Id::ROOT, SmallVec::new());
        Self {
            dirty: true,
            live: Default::default(),
            dead: Default::default(),
            order,
            linear_idx: Default::default(),
        }
    }
}

impl Store {
    /// Dirty is initially true and is set to true whenever the value held may
    /// have changed.
    pub fn is_dirty(&self) -> bool {
        self.dirty
    }

    pub fn clear_dirty(&mut self) {
        self.dirty = false;
    }

    pub fn groups(&self) -> GroupsIter {
        GroupsIter::new(self.live.iter())
    }

    pub fn live(&self) -> LiveIter {
        LiveIter(self.live.keys())
    }

    pub fn child_order(&self, id: Id) -> Option<ChildOrderIter> {
        let order = self.order.get(&id)?;
        Some(ChildOrderIter(order.iter()))
    }

    pub fn parent(&self, id: Id) -> Option<feature::Id> {
        let at = self.live.get(&id)?.at.as_value().as_ref()?;
        Some(at.parent)
    }

    pub fn first_child(&self, id: Id) -> Option<feature::Id> {
        self.order.get(&id)?.first().map(|entry| entry.id)
    }

    pub fn next_sibling(&self, id: Id) -> Option<feature::Id> {
        let order = self.order.get(&id)?;
        let idx = order.binary_search_by_key(&id, |entry| entry.id).ok()?;
        order.get(idx + 1).map(|entry| entry.id)
    }

    pub fn attrs(&self, id: Id) -> Option<&attr::Store> {
        let feature = self.live.get(&id)?;
        Some(&feature.attrs)
    }

    pub fn attrs_mut(&mut self, id: Id) -> Option<&mut attr::Store> {
        let feature = self.live.get_mut(&id)?;
        Some(&mut feature.attrs)
    }

    pub fn ty(&self, id: Id) -> Result<feature::Type> {
        let feature = self.live.get(&id).ok_or("missing feature")?;
        Ok(feature.ty)
    }

    pub fn linear_idx(&self, id: Id) -> Result<u32> {
        self.linear_idx
            .get(&id)
            .copied()
            .ok_or("missing feature".into())
    }

    pub(crate) fn at(&self, id: Id) -> Result<Option<&At>> {
        let feature = self.live.get(&id).ok_or("missing feature")?;
        Ok(feature.at.as_value().as_ref())
    }

    pub(crate) fn contains(&self, id: Id) -> bool {
        self.live.contains_key(&id)
    }

    #[tracing::instrument(skip_all)]
    pub(crate) fn merge(&mut self, clock: &mut LClock, r: &feature_store::Reader) -> Result<()> {
        let dead = r.get_dead()?;
        let live = r.get_live()?;

        if dead.len() > 0 || live.len() > 0 {
            self.dirty = true;
        }

        for r in dead.iter() {
            let id = read_dead_id(&r)?;
            tracing::trace!(?id, dead = ?self.dead.get(&id), live = ?self.live.get(&id), "incoming dead (before)");

            self.dead.insert(id);

            if let Some(prev) = self.live.remove(&id) {
                if prev.ty == Type::GROUP {
                    self.order.remove(&id);
                }

                if let Some(at) = prev.at.as_value() {
                    if let Some(parent_order) = self.order.get_mut(&at.parent) {
                        if let Ok(i) = search_order(parent_order, id, &at.idx) {
                            parent_order.remove(i);
                        }
                    }
                }
            }

            tracing::trace!(?id, dead = ?self.dead.get(&id), live = ?self.live.get(&id), "incoming dead (after)");
        }

        for r in live.iter() {
            let id = read_id(&r)?;
            clock.observe(id.into_inner()); // The feature id doubles as the creation timestamp

            tracing::trace!(
                ?id,
                dead = ?self.dead.get(&id),
                live = ?self.live.get(&id),
                own_order = ?self.order.get(&id),
                parent_order = ?self.live.get(&id)
                    .map(|f| f.at.as_value().as_ref())
                    .flatten()
                    .map(|at| self.order.get(&at.parent))
                    .flatten(),
                "incoming live (before)"
            );

            if self.dead.contains(&id) {
                continue;
            }

            let ty = feature::Type(r.get_type());

            let feature = self.live.entry(id).or_insert_with(|| Feature {
                ty,
                ..Default::default()
            });

            if feature.ty != ty {
                let local = feature.ty;
                if ty < feature.ty {
                    feature.ty = ty;
                }

                tracing::warn!(
                    ?id, ?local, incoming = ?ty, chosen = ?feature.ty,
                    "Feature type mismatch: chosing lowest",
                );
            }

            if feature.ty == Type::GROUP {
                self.order.entry(id).or_default();
            }

            if r.has_at_ts() {
                let at = read_at(&r)?;
                clock.observe(at.ts());

                if let Some(prev_at) = feature.at.merge(at) {
                    if let Some(prev_at) = prev_at {
                        if let Some(parent_order) = self.order.get_mut(&prev_at.parent) {
                            if let Ok(i) = search_order(parent_order, id, &prev_at.idx) {
                                parent_order.remove(i);
                            }
                        }
                    }

                    if let Some(at) = feature.at.as_value().as_ref() {
                        let parent_order = self.order.entry(at.parent).or_default();
                        if let Err(i) = search_order(parent_order, id, &at.idx) {
                            parent_order.insert(
                                i,
                                OrderEntry {
                                    id,
                                    ty,
                                    idx: at.idx.clone(),
                                },
                            );
                        }
                    }
                }
            }

            feature.attrs.merge(clock, &r.get_attrs()?)?;

            tracing::trace!(
                ?id,
                dead = ?self.dead.get(&id),
                live = ?self.live.get(&id),
                own_order = ?self.order.get(&id),
                parent_order = ?self.live.get(&id)
                    .map(|f| f.at.as_value().as_ref())
                    .flatten()
                    .map(|at| self.order.get(&at.parent))
                    .flatten(),
                "incoming live (after)"
            );
        }

        // Compute linear idx

        let mut idx = 0;
        let mut linear_idx = HashMap::with_capacity(self.linear_idx.len());

        let mut stack = Vec::with_capacity(16);
        let root = self.child_order(feature::Id::ROOT).expect("has root");
        stack.push(root);

        while let Some(mut group) = stack.pop() {
            for (child, ty) in &mut group {
                linear_idx.insert(child, idx);
                idx += 1;

                if ty.is_group() && let Some(child_group) = self.child_order(child) {
                    stack.push(group);
                    stack.push(child_group);
                    break;
                }
            }
        }

        self.linear_idx = linear_idx;

        Ok(())
    }

    #[tracing::instrument]
    pub(crate) fn save(&self, out: &mut Delta) {
        out.live_features.reserve(self.live.len());
        out.dead_features.reserve(self.dead.len());

        for (id, feature) in self.live.iter() {
            let mut attrs = Vec::new();
            feature.attrs.save(&mut attrs);

            out.live_features.push(FeatureDelta {
                id: *id,
                ty: feature.ty,
                at: feature.at.clone(),
                attrs,
            })
        }

        for id in self.dead.iter() {
            out.dead_features.push(*id);
        }
    }
}

#[derive(Debug, Clone)]
pub struct GroupsIter<'a> {
    yielded_root: bool,
    inner: hash_map::Iter<'a, Id, Feature>,
}

impl<'a> GroupsIter<'a> {
    fn new(inner: hash_map::Iter<'a, Id, Feature>) -> Self {
        Self {
            yielded_root: false,
            inner,
        }
    }
}

impl<'a> Iterator for GroupsIter<'a> {
    type Item = Id;

    fn next(&mut self) -> Option<Self::Item> {
        if !self.yielded_root {
            self.yielded_root = true;
            return Some(Id::ROOT);
        }

        self.inner
            .find(|(_id, v)| v.ty == Type::GROUP)
            .map(|(id, _)| *id)
    }
}

#[derive(Debug, Clone)]
pub struct LiveIter<'a>(hash_map::Keys<'a, Id, Feature>);

impl<'a> Iterator for LiveIter<'a> {
    type Item = Id;

    fn next(&mut self) -> Option<Self::Item> {
        self.0.next().cloned()
    }
}

impl ExactSizeIterator for LiveIter<'_> {
    fn len(&self) -> usize {
        self.0.len()
    }
}

#[derive(Debug, Clone, Default)]
pub struct ChildOrderIter<'a>(slice::Iter<'a, OrderEntry>);

impl<'a> Iterator for ChildOrderIter<'a> {
    type Item = (Id, feature::Type);

    fn next(&mut self) -> Option<Self::Item> {
        self.0.next().map(|entry| (entry.id, entry.ty))
    }
}

impl<'a> ExactSizeIterator for ChildOrderIter<'a> {
    fn len(&self) -> usize {
        self.0.len()
    }
}

fn search_order(order: &[OrderEntry], id: Id, idx: &FracIdx) -> core::result::Result<usize, usize> {
    order.binary_search_by_key(&(idx, id), |entry| (&entry.idx, entry.id))
}

fn read_at(r: &feature_store::feature::Reader) -> Result<LwwReg<Option<feature::At>>> {
    let at = if r.has_at_idx() && r.has_at_parent() {
        Some(feature::At {
            idx: r.get_at_idx().and_then(read_frac_idx)?,
            parent: r.get_at_parent().map(read_l_instant).map(feature::Id)?,
        })
    } else {
        None
    };
    let at_ts = if r.has_at_ts() {
        r.get_at_ts().map(read_l_instant)
    } else {
        Err(capnp::Error::failed("feature missing at_ts".to_string()))
    }?;
    Ok(LwwReg::new(at, at_ts))
}

fn read_dead_id(r: &feature_store::dead_feature::Reader) -> Result<feature::Id> {
    if r.has_id() {
        let value = read_l_instant(r.get_id()?);
        Ok(feature::Id(value))
    } else {
        Err("dead feature missing id".into())
    }
}

fn read_id(r: &feature_store::feature::Reader) -> Result<feature::Id> {
    if r.has_id() {
        let value = read_l_instant(r.get_id()?);
        Ok(feature::Id(value))
    } else {
        Err("feature missing id".into())
    }
}

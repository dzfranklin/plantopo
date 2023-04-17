use super::*;
use crate::{capnp_support::*, delta_capnp::delta::feature_store, prelude::*};

#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct Store {
    live: HashMap<Id, Feature>,
    dead: HashSet<Id>,
    order: HashMap<Id, SmallVec<[OrderEntry; 8]>>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
struct OrderEntry {
    id: Id,
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

impl Store {
    pub(crate) fn at(&self, id: Id) -> Result<Option<&At>> {
        let feature = self.live.get(&id).ok_or("missing feature")?;
        Ok(feature.at.as_value().as_ref())
    }

    pub(crate) fn ty(&self, id: Id) -> Option<feature::Type> {
        let feature = self.live.get(&id)?;
        Some(feature.ty)
    }

    pub(crate) fn contains(&self, id: Id) -> bool {
        self.live.contains_key(&id)
    }

    pub(crate) fn order(&self, id: Id) -> Option<OrderIter> {
        let order = self.order.get(&id)?;
        Some(OrderIter(order.iter()))
    }

    pub(crate) fn attrs(&self, id: Id) -> Option<attr::Iter> {
        let feature = self.live.get(&id)?;
        Some(feature.attrs.iter())
    }

    #[tracing::instrument(skip_all)]
    pub(crate) fn merge(&mut self, clock: &mut LClock, r: &feature_store::Reader) -> Result<()> {
        for r in r.get_dead()?.iter() {
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

        for r in r.get_live()?.iter() {
            let id = read_id(&r)?;
            clock.observe(id.into()); // The feature id doubles as the creation timestamp

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
                let change = feature.at.merge(at);

                if let Some(prev_at) = change {
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

        Ok(())
    }

    #[tracing::instrument(skip(b))]
    pub(crate) fn save(&self, mut b: feature_store::Builder) {
        {
            let values = self.live.iter();
            let mut b = b.reborrow().init_live(values.len() as u32);
            for (i, (&id, v)) in values.enumerate() {
                let mut b = b.reborrow().get(i as u32);

                write_l_instant(b.reborrow().init_id(), id.into());
                b.set_type(v.ty.into());

                if let Some(at) = v.at.as_value() {
                    write_frac_idx(b.reborrow().init_at_idx(), &at.idx);
                    write_l_instant(b.reborrow().init_at_parent(), at.parent.into());
                }
                write_l_instant(b.reborrow().init_at_ts(), v.at.ts());

                v.attrs.save(b.reborrow().init_attrs());
            }
        }

        {
            let values = self.dead.iter();
            let mut b = b.init_dead(values.len() as u32);
            for (i, &v) in values.enumerate() {
                let b = b.reborrow().get(i as u32);
                write_l_instant(b.init_id(), v.into());
            }
        }
    }
}

#[derive(Debug, Clone)]
pub struct OrderIter<'a>(slice::Iter<'a, OrderEntry>);

impl<'a> Iterator for OrderIter<'a> {
    type Item = Id;

    fn next(&mut self) -> Option<Self::Item> {
        self.0.next().map(|entry| entry.id)
    }
}

impl<'a> ExactSizeIterator for OrderIter<'a> {
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

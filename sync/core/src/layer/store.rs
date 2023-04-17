use super::*;
use crate::{capnp_support::*, delta_capnp::delta::layer_store, prelude::*};

#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct Store {
    value: HashMap<Id, Layer>,
    order: SmallVec<[(FracIdx, Id); 8]>,
}

#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct Layer {
    at: LwwReg<Option<FracIdx>>,
    attrs: attr::Store,
}

impl Store {
    pub(crate) fn get_at(&self, id: &Id) -> Result<Option<&FracIdx>> {
        let layer = self.value.get(id).ok_or("missing layer")?;
        Ok(layer.at.as_value().as_ref())
    }

    pub(crate) fn contains(&self, id: &Id) -> bool {
        self.value.contains_key(id)
    }

    pub(crate) fn order(&self) -> OrderIter {
        OrderIter(self.order.iter())
    }

    pub(crate) fn attrs(&self, id: &Id) -> Option<attr::Iter> {
        let layer = self.value.get(id)?;
        Some(layer.attrs.iter())
    }

    #[tracing::instrument(skip_all)]
    pub(crate) fn merge(&mut self, clock: &mut LClock, delta: &layer_store::Reader) -> Result<()> {
        for r in delta.get_value()?.iter() {
            let id = read_id(&r)?;

            tracing::trace!(?id, layer = ?self.value.get(&id), "(before)");

            let layer = self.value.entry(id).or_default();

            if r.has_at_ts() {
                let at = read_at(&r)?;
                clock.observe(at.ts());
                let prev = layer.at.merge(at);

                if let Some(Some(prev)) = prev {
                    if let Ok(i) = self.order.binary_search(&(prev, id)) {
                        self.order.remove(i);
                    }
                }

                if let Some(at) = layer.at.as_value() {
                    let key = (at.clone(), id);
                    if let Err(i) = self.order.binary_search(&key) {
                        self.order.insert(i, key);
                    } else {
                        unreachable!("We just removed it from the layer order list");
                    }
                }
            }

            layer.attrs.merge(clock, &r.get_attrs()?)?;

            tracing::trace!(?id, ?layer, "(after)");
        }
        Ok(())
    }

    #[tracing::instrument(skip(b))]
    pub(crate) fn save(&self, mut b: layer_store::Builder) {
        let mut b = b.reborrow().init_value(self.value.len() as u32);
        for (i, (id, v)) in self.value.iter().enumerate() {
            let mut b = b.reborrow().get(i as u32);

            write_uuid(b.reborrow().init_id(), id.clone().into());

            if let Some(at) = v.at.as_value() {
                write_frac_idx(b.reborrow().init_at(), at);
            }
            write_l_instant(b.reborrow().init_at_ts(), v.at.ts());

            v.attrs.save(b.init_attrs());
        }
    }
}

pub struct OrderIter<'a>(slice::Iter<'a, (FracIdx, Id)>);

impl<'a> Iterator for OrderIter<'a> {
    type Item = Id;

    fn next(&mut self) -> Option<Self::Item> {
        self.0.next().map(|(_, id)| *id)
    }
}

impl ExactSizeIterator for OrderIter<'_> {
    fn len(&self) -> usize {
        self.0.len()
    }
}

fn read_id(r: &layer_store::layer::Reader) -> Result<layer::Id> {
    if r.has_id() {
        let value = read_uuid(r.get_id()?);
        Ok(layer::Id(value))
    } else {
        Err("layer missing id".into())
    }
}

fn read_at(r: &layer_store::layer::Reader) -> Result<LwwReg<Option<FracIdx>>> {
    let at = if r.has_at() {
        Some(r.get_at().and_then(read_frac_idx)?)
    } else {
        None
    };

    if !r.has_at_ts() {
        return Err("layer missing at_ts".into());
    }
    let at_ts = r.get_at_ts().map(read_l_instant)?;

    Ok(LwwReg::new(at, at_ts))
}

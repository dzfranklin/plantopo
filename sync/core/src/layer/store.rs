use super::*;
use crate::{capnp_support::*, delta::LayerDelta, delta_capnp::delta::layer_store, prelude::*};

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Store {
    dirty: bool,
    value: HashMap<Id, Layer>,
    order: SmallVec<[(FracIdx, Id); 8]>,
}

#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct Layer {
    pub(crate) at: LwwReg<Option<FracIdx>>,
    pub(crate) attrs: attr::Store,
}

impl Default for Store {
    fn default() -> Self {
        Self {
            dirty: true,
            value: HashMap::default(),
            order: SmallVec::default(),
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

    pub fn order(&self) -> OrderIter {
        OrderIter(self.order.iter())
    }

    pub fn attrs(&self, id: Id) -> Option<&attr::Store> {
        let layer = self.value.get(&id)?;
        Some(&layer.attrs)
    }

    pub fn attrs_mut(&mut self, id: Id) -> Option<&mut attr::Store> {
        let layer = self.value.get_mut(&id)?;
        Some(&mut layer.attrs)
    }

    pub(crate) fn get_at(&self, id: &Id) -> Result<Option<&FracIdx>> {
        let layer = self.value.get(id).ok_or("missing layer")?;
        Ok(layer.at.as_value().as_ref())
    }

    pub(crate) fn contains(&self, id: &Id) -> bool {
        self.value.contains_key(id)
    }

    #[tracing::instrument(skip_all)]
    pub(crate) fn merge(&mut self, clock: &mut LClock, delta: &layer_store::Reader) -> Result<()> {
        let value = delta.get_value()?;

        if value.len() > 0 {
            self.dirty = true;
        }

        for r in value.iter() {
            let id = read_id(&r)?;

            tracing::trace!(?id, layer = ?self.value.get(&id), order = ?self.order, "(before)");

            let layer = self.value.entry(id).or_default();

            if r.has_at_ts() {
                let at = read_at(&r)?;
                clock.observe(at.ts());

                if let Some(prev_at) = layer.at.merge(at) {
                    if let Some(prev_at) = prev_at {
                        if let Ok(i) = self.order.binary_search(&(prev_at, id)) {
                            self.order.remove(i);
                        }
                    }

                    if let Some(at) = layer.at.as_value() {
                        let key = (at.clone(), id);
                        if let Err(i) = self.order.binary_search(&key) {
                            self.order.insert(i, key);
                        }
                    }
                }
            }

            layer.attrs.merge(clock, &r.get_attrs()?)?;

            tracing::trace!(?id, ?layer, order = ?self.order, "(after)");
        }
        Ok(())
    }

    #[tracing::instrument]
    pub(crate) fn save(&self, out: &mut Delta) {
        out.layers.reserve(self.value.len());
        for (id, layer) in self.value.iter() {
            let mut attrs = Vec::new();
            layer.attrs.save(&mut attrs);

            out.layers.push(LayerDelta {
                id: *id,
                at: layer.at,
                attrs,
            });
        }
    }
}

#[derive(Debug, Clone, Default)]
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

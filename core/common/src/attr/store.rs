use super::*;
use crate::{capnp_support::*, delta_capnp::delta::attrs, prelude::*};

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Store {
    dirty: bool,
    value: HashMap<Key, LwwReg<Value>>,
}

impl Default for Store {
    fn default() -> Self {
        Self {
            dirty: true,
            value: Default::default(),
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

    pub fn iter(&self) -> Iter {
        Iter(self.value.iter())
    }

    #[tracing::instrument(skip(delta))]
    pub(crate) fn merge(&mut self, clock: &mut LClock, delta: &attrs::Reader) -> Result<()> {
        use attrs::attr::value::Which;

        let value = delta.get_value()?;

        if value.len() > 0 {
            self.dirty = true;
        }

        for r in value.iter() {
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

            clock.observe(ts);
            self.value.entry(key).or_default().merge(value);
        }

        Ok(())
    }

    #[tracing::instrument]
    pub(crate) fn save(&self, out: &mut Vec<(Key, LwwReg<Value>)>) {
        out.reserve(self.value.len());
        for (k, v) in self.value.iter() {
            out.push((k.clone(), v.clone()));
        }
    }
}

#[derive(Debug, Clone)]
pub struct Iter<'a>(hash_map::Iter<'a, Key, LwwReg<Value>>);

impl<'a> Iterator for Iter<'a> {
    type Item = (&'a Key, &'a Value);

    fn next(&mut self) -> Option<Self::Item> {
        self.0.next().map(|(k, v)| (k, v.as_value()))
    }
}

impl<'a> ExactSizeIterator for Iter<'a> {
    fn len(&self) -> usize {
        self.0.len()
    }
}

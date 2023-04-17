use super::*;
use crate::{capnp_support::*, delta_capnp::delta::attrs, prelude::*};

#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct Store {
    value: HashMap<Key, LwwReg<Value>>,
}

impl Store {
    pub(crate) fn iter(&self) -> Iter {
        Iter(self.value.iter())
    }

    #[tracing::instrument(skip(delta))]
    pub(crate) fn merge(&mut self, clock: &mut LClock, delta: &attrs::Reader) -> Result<()> {
        use attrs::attr::value::Which;

        for r in delta.get_value()?.iter() {
            let key = r.get_key().into();
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

    #[tracing::instrument(skip(b))]
    pub(crate) fn save(&self, b: attrs::Builder) {
        let mut b = b.init_value(self.value.len() as u32);
        for (i, (&key, value)) in self.value.iter().enumerate() {
            let b = b.reborrow().get(i as u32);
            write_attr(b, key, value.as_value(), value.ts())
        }
    }
}

pub struct Iter<'a>(hashbrown::hash_map::Iter<'a, Key, LwwReg<Value>>);

impl<'a> Iterator for Iter<'a> {
    type Item = (Key, &'a Value);

    fn next(&mut self) -> Option<Self::Item> {
        self.0.next().map(|(k, v)| (*k, v.as_value()))
    }
}

impl<'a> ExactSizeIterator for Iter<'a> {
    fn len(&self) -> usize {
        self.0.len()
    }
}

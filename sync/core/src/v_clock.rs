use crate::prelude::*;

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
pub struct VClock(BTreeMap<ClientId, u32>);

impl VClock {
    pub fn new() -> Self {
        Self(BTreeMap::new())
    }

    pub fn set(&mut self, value: LInstant) {
        let entry = self.0.entry(value.client()).or_default();
        *entry = value.counter().max(*entry);
    }

    pub fn get(&self, id: ClientId) -> LInstant {
        let value = self.0.get(&id).map(|v| *v).unwrap_or_default();
        LInstant::new(id, value)
    }

    pub fn tick(&mut self, id: ClientId) -> LInstant {
        let value = self.get(id) + 1;
        self.set(value);
        value
    }

    pub fn has_observed(&self, clock: LInstant) -> bool {
        self.get(clock.client()) >= clock
    }
}

use crate::prelude::*;

#[derive(Default, Clone, PartialEq, Eq)]
pub struct LClock(LInstant);

impl LClock {
    pub fn new(id: ClientId, counter: u64) -> Self {
        Self(LInstant::new(id, counter))
    }

    pub fn tick(&mut self) {
        self.0 = self.0.with_tick();
        tracing::trace!("Ticked to {:?}", self.0);
    }

    pub fn now(&self) -> LInstant {
        self.0
    }

    pub fn observe(&mut self, ts: LInstant) {
        if ts > self.0 {
            self.0 = self.0.with_counter(ts.counter);
            tracing::trace!("Observed to {:?}", self.0);
        } else {
            tracing::trace!("Observe (no change)");
        }
    }
}

impl From<LClock> for LInstant {
    fn from(l: LClock) -> Self {
        l.0
    }
}

impl From<LInstant> for LClock {
    fn from(l: LInstant) -> Self {
        Self(l)
    }
}

impl fmt::Debug for LClock {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "LClock({:?})", self.0)
    }
}

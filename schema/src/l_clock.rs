use crate::{ClientId, LInstant, OutOfBoundsError};

#[derive(Debug, Default, Clone, Copy, PartialEq, Eq)]
pub struct LClock(LInstant);

impl LClock {
    pub fn new(client: ClientId) -> Self {
        let inner = LInstant::new(client, 0).expect("0 does not overflow LInstant");
        Self(inner)
    }

    pub fn tick(&mut self) -> Result<(), OutOfBoundsError> {
        self.0 = LInstant::new(self.0.client(), self.0.counter() + 1)?;
        Ok(())
    }

    pub fn merge(&mut self, other: u64) -> Result<(), OutOfBoundsError> {
        let other = LInstant::try_from(other)?;
        self.0 = LInstant::new(self.0.client(), self.0.counter().max(other.counter()) + 1)?;
        Ok(())
    }

    pub fn now(&self) -> u64 {
        self.0.inner()
    }

    pub fn inner(&self) -> LInstant {
        self.0
    }

    pub fn client(&self) -> ClientId {
        self.0.client()
    }

    pub fn counter(&self) -> u32 {
        self.0.counter()
    }
}

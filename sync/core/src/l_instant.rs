use core::ops::Add;

use crate::prelude::*;

#[derive(Serialize, Deserialize, PartialEq, Eq, Clone, Copy, Hash, Default)]
pub struct LInstant {
    counter: u32,
    client_id: ClientId,
}

impl LInstant {
    pub const fn new(client_id: ClientId, counter: u32) -> Self {
        Self { counter, client_id }
    }

    pub fn with_counter(self, counter: u32) -> Self {
        Self { counter, ..self }
    }

    pub fn with_tick(self) -> Self {
        Self {
            counter: self.counter + 1,
            ..self
        }
    }

    pub fn max_counter(self, other: Self) -> u32 {
        if self > other {
            self.counter()
        } else {
            other.counter()
        }
    }

    pub fn counter(self) -> u32 {
        self.counter
    }

    pub fn client(self) -> ClientId {
        self.client_id
    }
}

impl Add<u32> for LInstant {
    type Output = Self;

    fn add(self, rhs: u32) -> Self::Output {
        self.with_counter(self.counter() + rhs)
    }
}

impl Ord for LInstant {
    fn cmp(&self, other: &Self) -> cmp::Ordering {
        match self.counter.cmp(&other.counter) {
            cmp::Ordering::Equal => self.client_id.cmp(&other.client_id),
            ord => ord,
        }
    }
}

impl PartialOrd for LInstant {
    fn partial_cmp(&self, other: &Self) -> Option<cmp::Ordering> {
        Some(self.cmp(other))
    }
}

impl fmt::Debug for LInstant {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "0x{:x}@{}", self.counter(), self.client())
    }
}

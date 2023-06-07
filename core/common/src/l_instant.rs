use core::ops::{Add, Sub};

use crate::prelude::*;

#[derive(PartialEq, Eq, Clone, Copy, Hash, Default)]
pub struct LInstant {
    pub counter: u64,
    pub client: ClientId,
}

impl LInstant {
    pub const fn new(client_id: ClientId, counter: u64) -> Self {
        Self {
            counter,
            client: client_id,
        }
    }

    pub const fn zero() -> Self {
        Self {
            counter: 0,
            client: ClientId(0),
        }
    }

    pub fn with_counter(self, counter: u64) -> Self {
        Self { counter, ..self }
    }

    pub fn with_tick(self) -> Self {
        Self {
            counter: self.counter + 1,
            ..self
        }
    }

    pub fn max_counter(self, other: Self) -> u64 {
        if self > other {
            self.counter
        } else {
            other.counter
        }
    }
}

impl Add<u64> for LInstant {
    type Output = Self;

    fn add(self, rhs: u64) -> Self::Output {
        self.with_counter(self.counter + rhs)
    }
}

impl Sub<u64> for LInstant {
    type Output = Self;

    fn sub(self, rhs: u64) -> Self::Output {
        self.with_counter(self.counter - rhs)
    }
}

impl Ord for LInstant {
    fn cmp(&self, other: &Self) -> cmp::Ordering {
        match self.counter.cmp(&other.counter) {
            cmp::Ordering::Equal => self.client.cmp(&other.client),
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
        write!(f, "0x{:x}@{}", self.counter, self.client)
    }
}

use crate::prelude::*;

#[derive(Debug, Clone, Default, PartialEq, Eq)]
/// Last-writer-wins register
pub struct LwwReg<T> {
    value: T,
    ts: LInstant,
}

impl<T> LwwReg<T> {
    pub fn new(value: T, ts: LInstant) -> Self {
        Self { value, ts }
    }

    pub fn as_value(&self) -> &T {
        &self.value
    }

    pub fn ts(&self) -> LInstant {
        self.ts
    }

    pub fn merge(&mut self, other: Self) -> Option<T> {
        if other.ts > self.ts {
            let prev = mem::replace(self, other);
            Some(prev.value)
        } else {
            None
        }
    }
}

impl<T> LwwReg<Option<T>> {
    pub fn unset() -> Self {
        Self {
            value: None,
            ts: LInstant::zero(),
        }
    }
}

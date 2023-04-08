use crate::prelude::*;

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
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
}

impl<T: Default> Merge for LwwReg<T> {
    fn merge(&mut self, other: Self) {
        if other.ts > self.ts {
            self.ts = other.ts;
            self.value = other.value;
        }
    }
}

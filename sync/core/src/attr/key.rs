use crate::prelude::*;

#[derive(PartialEq, Eq, Hash, PartialOrd, Ord, Clone, Copy)]
pub struct Key(pub u16);

impl From<u16> for Key {
    fn from(v: u16) -> Self {
        Self(v)
    }
}

impl From<Key> for u16 {
    fn from(v: Key) -> Self {
        v.0
    }
}

impl fmt::Debug for Key {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "Key(0x{:x})", self.0)
    }
}

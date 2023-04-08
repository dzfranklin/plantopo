use crate::prelude::*;

#[derive(Serialize, Deserialize, Eq, PartialEq, PartialOrd, Ord, Clone, Copy, Hash)]
#[repr(transparent)]
pub struct ClientId(pub u32);

impl fmt::Display for ClientId {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "0x{:x}", self.0)
    }
}

impl fmt::Debug for ClientId {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "ClientId({})", self)
    }
}

impl Default for ClientId {
    fn default() -> Self {
        Self(0)
    }
}

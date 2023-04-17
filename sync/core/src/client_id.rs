use crate::prelude::*;

#[derive(Eq, PartialEq, PartialOrd, Ord, Clone, Copy, Hash)]
pub struct ClientId(pub u64);

impl ClientId {
    pub fn into_inner(self) -> u64 {
        self.0
    }
}

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

impl From<u64> for ClientId {
    fn from(v: u64) -> Self {
        Self(v)
    }
}

impl From<ClientId> for u64 {
    fn from(v: ClientId) -> Self {
        v.0
    }
}

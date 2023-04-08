use crate::prelude::*;

// TODO: Switch to state based with delta updates?
// IE: send [(k, v)] to set one attribute

// TODO: Make at, trashed, etc just special attributes?

#[derive(Debug, Deserialize, Serialize, Clone, PartialEq)]
#[non_exhaustive]
pub enum SyncProto<'a> {
    Broadcast(Op),
    RequestSync(Cow<'a, VClock>),
    Sync(alloc::vec::Vec<Op>),
    Error(SmolStr),
}

impl<'a> SyncProto<'a> {
    pub fn to_bytes(&self) -> core::result::Result<alloc::vec::Vec<u8>, postcard::Error> {
        postcard::to_allocvec(self)
    }

    pub fn from_bytes(bytes: &[u8]) -> core::result::Result<Self, postcard::Error> {
        postcard::from_bytes(bytes)
    }
}

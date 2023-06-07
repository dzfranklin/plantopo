use crate::prelude::*;
use alloc::string::String;

#[derive(PartialEq, Eq, Hash, PartialOrd, Ord, Clone)]
pub struct Key(pub String);

impl Key {
    pub fn into_inner(self) -> String {
        self.0
    }
}

impl AsRef<str> for Key {
    fn as_ref(&self) -> &str {
        &self.0
    }
}

impl From<String> for Key {
    fn from(v: String) -> Self {
        Self(v)
    }
}

impl From<Key> for String {
    fn from(v: Key) -> Self {
        v.0
    }
}

impl fmt::Debug for Key {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "Key({})", self.0)
    }
}

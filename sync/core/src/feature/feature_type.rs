use crate::prelude::*;

#[derive(Clone, Copy, Eq, PartialEq, PartialOrd, Hash, Ord)]
pub struct Type(pub u8);

impl Type {
    pub const GROUP: Self = Self(1);
    pub const POINT: Self = Self(2);
    pub const ROUTE: Self = Self(3);

    pub fn into_inner(self) -> u8 {
        self.0
    }

    pub fn is_group(&self) -> bool {
        *self == Self::GROUP
    }
}

impl Default for Type {
    fn default() -> Self {
        Self::POINT
    }
}

impl fmt::Debug for Type {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match *self {
            Self::GROUP => write!(f, "G")?,
            Self::POINT => write!(f, "P")?,
            Self::ROUTE => write!(f, "R")?,
            Self(other) => write!(f, "{}", other)?,
        };
        Ok(())
    }
}

impl From<u8> for Type {
    fn from(v: u8) -> Self {
        Self(v)
    }
}

impl From<Type> for u8 {
    fn from(v: Type) -> Self {
        v.0
    }
}

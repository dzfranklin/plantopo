use crate::prelude::*;

#[derive(Clone, Copy, Eq, PartialEq, PartialOrd)]
pub struct Type(pub u8);

impl Type {
    pub const GROUP: Self = Self(1);
    pub const POINT: Self = Self(2);
    pub const ROUTE: Self = Self(3);

    pub fn into_inner(self) -> u8 {
        self.0
    }
}

impl Default for Type {
    fn default() -> Self {
        Self::POINT
    }
}

impl fmt::Debug for Type {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "feature::Type(")?;
        match *self {
            Self::GROUP => write!(f, "GROUP")?,
            Self::POINT => write!(f, "POINT")?,
            Self::ROUTE => write!(f, "ROUTE")?,
            Self(other) => write!(f, "{}", other)?,
        };
        write!(f, ")")?;
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

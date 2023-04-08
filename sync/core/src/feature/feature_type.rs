use crate::prelude::*;

#[derive(Serialize, Deserialize, Clone, Copy, Eq, PartialEq)]
pub struct Type(pub u8);

impl Type {
    pub const GROUP: Self = Self(1);
    pub const POINT: Self = Self(2);
    pub const ROUTE: Self = Self(3);
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

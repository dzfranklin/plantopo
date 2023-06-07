use crate::prelude::*;

#[derive(PartialEq, Eq, PartialOrd, Ord, Hash, Clone, Copy, Default)]
#[repr(transparent)]
pub struct Id(pub Uuid);

impl Id {
    pub fn into_inner(self) -> Uuid {
        self.0
    }
}

impl FromStr for Id {
    type Err = uuid::Error;

    fn from_str(s: &str) -> core::result::Result<Self, Self::Err> {
        Ok(Self(Uuid::from_str(s)?))
    }
}

impl fmt::Debug for Id {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "layer::Id({:?})", self.0)
    }
}

impl From<Uuid> for Id {
    fn from(id: Uuid) -> Self {
        Self(id)
    }
}

impl From<Id> for Uuid {
    fn from(id: Id) -> Self {
        id.0
    }
}

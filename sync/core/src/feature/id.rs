use crate::prelude::*;

#[derive(PartialEq, Eq, PartialOrd, Ord, Hash, Clone, Copy)]
#[repr(transparent)]
pub struct Id(pub LInstant);

impl Id {
    pub const ROOT: Self = Self(LInstant::new(ClientId(0), 0));

    pub fn into_inner(self) -> LInstant {
        self.0
    }
}

impl fmt::Debug for Id {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        if self == &Self::ROOT {
            write!(f, "feature::Id::ROOT")
        } else {
            write!(f, "feature::Id({:?})", self.0)
        }
    }
}

impl From<LInstant> for Id {
    fn from(ts: LInstant) -> Self {
        Self(ts)
    }
}

impl From<Id> for LInstant {
    fn from(id: Id) -> Self {
        id.0
    }
}

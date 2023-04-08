use crate::prelude::*;

#[derive(PartialEq, Eq, PartialOrd, Ord, Hash, Clone, Copy, Serialize, Deserialize)]
#[repr(transparent)]
pub struct Id(pub LInstant);

impl Id {
    pub const ROOT: Self = Self(LInstant::new(ClientId(0), 0));
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

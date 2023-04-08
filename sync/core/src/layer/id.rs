use crate::prelude::*;

#[derive(PartialEq, Eq, PartialOrd, Ord, Hash, Clone, Copy, Serialize, Deserialize, Default)]
#[repr(transparent)]
pub struct Id(pub Uuid);

impl fmt::Debug for Id {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "layer::Id({:?})", self.0)
    }
}

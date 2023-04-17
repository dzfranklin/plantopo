use crate::prelude::*;

#[derive(Clone, Copy, Eq, PartialEq, Hash)]
pub struct MapId(pub Uuid);

impl MapId {
    pub fn into_inner(self) -> Uuid {
        self.0
    }
}

impl fmt::Debug for MapId {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "MapId({})", self.0)
    }
}

impl FromStr for MapId {
    type Err = uuid::Error;

    fn from_str(s: &str) -> core::result::Result<Self, Self::Err> {
        Ok(Self(Uuid::from_str(s)?))
    }
}

impl From<Uuid> for MapId {
    fn from(uuid: Uuid) -> Self {
        Self(uuid)
    }
}

impl From<MapId> for Uuid {
    fn from(id: MapId) -> Self {
        id.0
    }
}

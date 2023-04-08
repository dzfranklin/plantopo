use crate::prelude::*;

#[derive(Serialize, Deserialize, Eq, PartialEq, PartialOrd, Ord, Clone, Copy, Hash)]
pub enum AnyId {
    Client(ClientId),
    Feature(feature::Id),
    Layer(layer::Id),
}

impl fmt::Debug for AnyId {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::Client(id) => write!(f, "{:?}", id),
            Self::Feature(id) => write!(f, "{:?}", id),
            Self::Layer(id) => write!(f, "{:?}", id),
        }
    }
}

impl TryFrom<AnyId> for ClientId {
    type Error = &'static str;

    fn try_from(id: AnyId) -> Result<Self> {
        match id {
            AnyId::Client(id) => Ok(id),
            _ => Err("expected client id"),
        }
    }
}

impl TryFrom<AnyId> for feature::Id {
    type Error = &'static str;

    fn try_from(id: AnyId) -> Result<Self> {
        match id {
            AnyId::Feature(id) => Ok(id),
            _ => Err("expected feature id"),
        }
    }
}

impl TryFrom<AnyId> for layer::Id {
    type Error = &'static str;

    fn try_from(id: AnyId) -> Result<Self> {
        match id {
            AnyId::Layer(id) => Ok(id),
            _ => Err("expected layer id"),
        }
    }
}

impl From<ClientId> for AnyId {
    fn from(id: ClientId) -> Self {
        AnyId::Client(id)
    }
}

impl From<feature::Id> for AnyId {
    fn from(id: feature::Id) -> Self {
        AnyId::Feature(id)
    }
}

impl From<layer::Id> for AnyId {
    fn from(id: layer::Id) -> Self {
        AnyId::Layer(id)
    }
}

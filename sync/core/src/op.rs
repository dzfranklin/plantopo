use crate::prelude::*;

#[derive(Debug, Deserialize, Serialize, Clone, PartialEq, Eq)]
pub struct Op {
    pub ts: LInstant,
    pub action: Action,
}

// For compat never delete or modify actions and add new actions at the end

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
pub enum Action {
    MoveLayer {
        id: layer::Id,
        at: Option<FracIdx>,
    },
    SetLayerAttr {
        id: layer::Id,
        key: SmolStr,
        value: AttrValue,
    },
    CreateFeature(feature::Type),
    MoveFeature {
        id: feature::Id,
        at: Option<feature::At>,
    },
    SetFeatureTrashed {
        id: feature::Id,
        value: bool,
    },
    SetFeatureAttr {
        id: feature::Id,
        key: SmolStr,
        value: AttrValue,
    },
    DeleteFeature(feature::Id),
}

impl Op {
    pub fn new(ts: LInstant, action: Action) -> Self {
        Self { ts, action }
    }

    pub fn to_bytes(&self) -> core::result::Result<alloc::vec::Vec<u8>, postcard::Error> {
        postcard::to_allocvec(self)
    }

    pub fn from_bytes(bytes: &[u8]) -> core::result::Result<Self, postcard::Error> {
        postcard::from_bytes(bytes)
    }
}

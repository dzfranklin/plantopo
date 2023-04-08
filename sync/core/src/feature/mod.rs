mod at;
mod feature_type;
mod id;

pub use at::At;
pub use feature_type::Type;
pub use id::Id;

use crate::prelude::*;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Feature {
    id: feature::Id,
    create_ts: LInstant,
    ty: feature::Type,
    data: WritableData,
}

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
pub struct WritableData {
    pub trashed: LwwReg<bool>,
    pub at: LwwReg<Option<feature::At>>,
    pub attrs: GMap<SmolStr, LwwReg<AttrValue>>,
}

impl Feature {
    pub fn new(ts: LInstant, id: feature::Id, ty: feature::Type) -> Self {
        Self {
            id,
            create_ts: ts,
            ty,
            data: WritableData {
                trashed: LwwReg::new(false, ts),
                at: LwwReg::new(None, ts),
                attrs: GMap::new(),
            },
        }
    }

    pub fn create_ts(&self) -> LInstant {
        self.create_ts
    }

    pub fn id(&self) -> feature::Id {
        self.id
    }

    pub fn ty(&self) -> feature::Type {
        self.ty
    }

    pub fn trashed(&self) -> &LwwReg<bool> {
        &self.data.trashed
    }

    pub fn at(&self) -> &LwwReg<Option<feature::At>> {
        &self.data.at
    }

    pub fn attrs(&self) -> &GMap<SmolStr, LwwReg<AttrValue>> {
        &self.data.attrs
    }
}

impl Merge<WritableData> for Feature {
    fn merge(&mut self, from: WritableData) {
        self.data.trashed.merge(from.trashed);
        self.data.at.merge(from.at);
        self.data.attrs.merge(from.attrs);
    }
}

impl PartialEq for Feature {
    fn eq(&self, other: &Self) -> bool {
        self.id == other.id
    }
}

impl PartialOrd for Feature {
    fn partial_cmp(&self, other: &Self) -> Option<cmp::Ordering> {
        let self_at = self.data.at.as_value().as_ref()?;
        let other_at = other.data.at.as_value().as_ref()?;

        if self_at.parent != other_at.parent {
            return None;
        }

        match self_at.idx.cmp(&other_at.idx) {
            cmp::Ordering::Equal => Some(self.id.cmp(&other.id)),
            ord => Some(ord),
        }
    }
}

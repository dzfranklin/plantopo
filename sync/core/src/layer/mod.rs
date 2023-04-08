mod id;

pub use id::Id;

use crate::prelude::*;

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
pub struct Layer {
    pub id: Id,
    pub at: LwwReg<Option<FracIdx>>,
    pub attrs: GMap<SmolStr, LwwReg<AttrValue>>,
}

impl Layer {
    pub fn new(id: Id, ts: LInstant) -> Self {
        Self {
            id,
            at: LwwReg::new(None, ts),
            attrs: GMap::new(),
        }
    }
}

impl Merge for Layer {
    fn merge(&mut self, other: Self) {
        self.at.merge(other.at);
        self.attrs.merge(other.attrs);
    }
}

impl PartialEq for Layer {
    fn eq(&self, other: &Self) -> bool {
        self.id == other.id
    }
}

impl PartialOrd for Layer {
    fn partial_cmp(&self, other: &Self) -> Option<cmp::Ordering> {
        let self_at = self.at.as_value().as_ref()?;
        let other_at = other.at.as_value().as_ref()?;

        match self_at.cmp(other_at) {
            cmp::Ordering::Equal => Some(self.id.cmp(&other.id)),
            ord => Some(ord),
        }
    }
}

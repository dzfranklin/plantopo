use core::ops::Div;

use crate::prelude::*;

#[derive(Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct At {
    pub parent: feature::Id,
    pub idx: FracIdx,
}

impl fmt::Debug for At {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{:?}/{:?}", &self.parent, &self.idx)
    }
}

impl Div<FracIdx> for feature::Id {
    type Output = At;

    fn div(self, rhs: FracIdx) -> Self::Output {
        At {
            parent: self,
            idx: rhs,
        }
    }
}

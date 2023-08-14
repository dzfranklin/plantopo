use serde::{Deserialize, Serialize};

/// Layer ID
///
/// Centrally created
#[derive(Clone, Copy, Debug, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize)]
pub struct Lid(u32);

impl Lid {
    pub fn new(lid: u32) -> Self {
        Lid(lid)
    }
}

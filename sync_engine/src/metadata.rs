use serde::{Deserialize, Serialize};

use crate::SPECIAL_FID_UNTIL;

#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct Metadata {
    pub next_fid_block_start: u64,
}

impl Default for Metadata {
    fn default() -> Self {
        Self {
            next_fid_block_start: SPECIAL_FID_UNTIL,
        }
    }
}

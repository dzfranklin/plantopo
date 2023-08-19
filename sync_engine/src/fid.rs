use std::fmt::Display;

use serde::{Deserialize, Serialize};

/// Feature ID
///
/// Must be creatable by offline clients
#[derive(Clone, Debug, Copy, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize)]
pub struct Fid(pub u64); // Must be < MAX_JS_SAFE_INTEGER

impl Fid {
    pub const ROOT: Fid = Fid(0);
}

impl Display for Fid {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{:x}", self.0)
    }
}

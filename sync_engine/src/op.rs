use std::collections::{HashMap, HashSet};

use serde::{Deserialize, Serialize};
use serde_json::Value;

use crate::{FPos, Fid, Key, Lid};

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(tag = "action", rename_all = "camelCase")]
pub enum Op {
    FCreate {
        fid: Fid,
        props: FCreateProps,
    },
    FDelete {
        // If you want to delete a feature with children also include every
        // descendant you know about. You'll get replies with deletions for the
        // ones you didn't include.
        fids: HashSet<Fid>,
    },
    FSet {
        fid: Fid,
        key: Key,
        value: Value,
    },
    LSet {
        lid: Lid,
        key: Key,
        value: Value,
    },
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FCreateProps {
    pub pos: FPos,
    #[serde(flatten)]
    pub rest: HashMap<Key, Value>,
}

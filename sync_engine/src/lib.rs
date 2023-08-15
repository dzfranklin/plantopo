#![feature(buf_read_has_data_left)]

mod change;
pub mod fid;
pub mod frac_idx;
pub mod lid;
pub mod store;

pub use self::change::Change;

use std::collections::{BTreeSet, HashMap, HashSet};

use eyre::{eyre, Context};
use fid::Fid;
use lid::Lid;
use petgraph::prelude::*;
use rand::{rngs::SmallRng, SeedableRng};
use serde::{Deserialize, Serialize};
use serde_json::Value;

use crate::{frac_idx::FracIdx, store::Store};

type Key = String;

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Pos {
    pub parent: Fid,
    pub idx: FracIdx,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(tag = "action", rename_all = "camelCase")]
pub enum Op {
    FCreate {
        fid: Fid,
        pos: Pos,
    },
    FDelete {
        fid: Fid,
    },
    FSet {
        fid: Fid,
        key: Key,
        value: Option<Value>,
    },
    LSet {
        lid: Lid,
        key: Key,
        value: Option<Value>,
    },
}

#[derive(Debug)]
pub struct Engine<S> {
    store: S,
    rng: SmallRng,
    feature_tree: DiGraphMap<Fid, FracIdx>,
    feature_props: PropMap<Fid>,
    deleted_features: HashSet<Fid>,
    layer_order: BTreeSet<(FracIdx, Lid)>,
    layer_props: PropMap<Lid>,
}

type PropMap<Id> = HashMap<Id, HashMap<String, Option<Value>>>;

#[derive(Debug, Clone, PartialEq, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Changeset {
    /// To send to the client who sent us the op.
    pub reply_only: Change,
    /// To send to all other clients.
    pub change: Change,
}

impl<S> Engine<S>
where
    S: Store,
{
    #[tracing::instrument(skip(store))]
    pub fn new(store: S, snapshot: Change) -> eyre::Result<Self> {
        // NOTE: We separate building the props dicts and special-casing
        // specific keys because keys can be duplicated in the Change

        // Load features

        let mut feature_tree = DiGraphMap::new();
        feature_tree.add_node(Fid::FEATURE_ROOT);

        let mut feature_props = PropMap::<Fid>::new();

        for (fid, k, v) in snapshot.iter_fprops() {
            feature_props
                .entry(fid)
                .or_default()
                .insert(k.clone(), v.cloned());
        }

        for (fid, props) in feature_props.iter() {
            let pos = props
                .get("pos")
                .ok_or_else(|| eyre!("pos cannot be missing"))?
                .clone()
                .ok_or_else(|| eyre!("pos cannot be undefined"))?;
            let pos: Pos = serde_json::from_value(pos.clone()).wrap_err("invalid pos value")?;
            feature_tree.add_edge(pos.parent, *fid, pos.idx);
        }

        let deleted_features = snapshot.deleted_features().iter().cloned().collect();

        // Load layers

        let mut layer_props = PropMap::<Lid>::new();
        let mut layer_order: BTreeSet<(FracIdx, Lid)> = BTreeSet::new();

        for (lid, k, v) in snapshot.iter_lprops() {
            layer_props
                .entry(lid)
                .or_default()
                .insert(k.clone(), v.cloned());
        }

        for (lid, props) in layer_props.iter() {
            if let Some(Some(idx)) = props.get("idx") {
                let idx: FracIdx =
                    serde_json::from_value(idx.clone()).wrap_err("invalid idx value")?;
                layer_order.insert((idx, *lid));
            }
        }

        Ok(Self {
            store,
            feature_tree,
            feature_props,
            deleted_features,
            layer_order,
            layer_props,
            rng: SmallRng::from_entropy(),
        })
    }

    pub fn store(&self) -> &S {
        &self.store
    }

    pub fn store_mut(&mut self) -> &mut S {
        &mut self.store
    }

    pub fn apply(&mut self, validate_by: u16, ops: Vec<Op>) -> eyre::Result<Changeset> {
        let mut cset = Changeset::default();

        for op in ops {
            match op {
                Op::FCreate { fid, mut pos } => {
                    if self.feature_tree.contains_node(fid) {
                        return Err(eyre!("oid already exists: {}", fid));
                    }
                    if self.deleted_features.contains(&fid) {
                        return Err(eyre!("oid deleted: {}", fid));
                    }
                    if !self.feature_tree.contains_node(pos.parent) {
                        return Err(eyre!("parent oid not found: {}", pos.parent));
                    }
                    if fid.client() != validate_by {
                        return Err(eyre!("tried to create feature with different oid client: got {fid:x?}, expected client={validate_by}"));
                    }

                    self.validate_and_fix_feature_pos(fid, &mut pos, &mut cset)?;

                    let pos = serde_json::to_value(pos)?;
                    cset.change.set_fprop(fid, "pos", Some(pos));
                }
                Op::FDelete { fid } => {
                    if !self.feature_tree.contains_node(fid) {
                        return Err(eyre!("oid not found in tree: {}", fid));
                    }

                    self.build_recursive_deletion(fid, &mut cset);
                }
                Op::FSet {
                    fid,
                    key,
                    mut value,
                } => {
                    if !self.feature_tree.contains_node(fid) {
                        return Err(eyre!("oid not found in tree: {}", fid));
                    }

                    if key == "pos" {
                        // This ensures "pos" is always set to something valid
                        let value_inner = value.ok_or_else(|| eyre!("missing pos value"))?;
                        let mut pos: Pos = serde_json::from_value(value_inner)
                            .wrap_err("invalid pos value for feature")?;

                        self.validate_and_fix_feature_pos(fid, &mut pos, &mut cset)?;
                        value = Some(serde_json::to_value(&pos)?);

                        if let Some(old_parent) = self.parent(fid) {
                            self.feature_tree.remove_edge(old_parent, fid);
                        } else {
                            tracing::warn!(?fid, "feature missing old parent");
                        }

                        self.feature_tree.add_edge(pos.parent, fid, pos.idx);
                    }

                    cset.change.set_fprop(fid, key.clone(), value.clone());
                    self.feature_props
                        .entry(fid)
                        .or_default()
                        .insert(key.clone(), value.clone());
                }
                Op::LSet {
                    lid,
                    key,
                    mut value,
                } => {
                    if key == "idx" {
                        let idx = if let Some(value) = value.clone() {
                            Some(serde_json::from_value(value)?)
                        } else {
                            None
                        };

                        self.layer_order.retain(|(_, other_id)| other_id != &lid);

                        if let Some(mut idx) = idx {
                            if let Some(fixed_idx) = self.layer_idx_collision_fix(&idx) {
                                value = Some(serde_json::to_value(&fixed_idx)?);
                                idx = fixed_idx;

                                cset.reply_only.set_lprop(lid, key.clone(), value.clone());
                            }
                            self.layer_order.insert((idx, lid));
                        }
                    }

                    cset.change.set_lprop(lid, key.clone(), value.clone());
                    self.layer_props
                        .entry(lid)
                        .or_default()
                        .insert(key.clone(), value.clone());
                }
            }
        }

        self.store.push(cset.change.clone())?;
        self.change(cset.change.clone())?;

        Ok(cset)
    }

    fn change(&mut self, change: Change) -> eyre::Result<()> {
        for (fid, k, v) in change.iter_fprops() {
            if k == "pos" {
                // Validate

                let v = v.cloned().ok_or_else(|| eyre!("pos cannot be undefined"))?;
                let pos: Pos = serde_json::from_value(v.clone()).wrap_err("invalid pos")?;

                if self.is_feature_parent_invalid(fid, pos.parent) {
                    return Err(eyre!("invalid feature parent"));
                }

                if self.pos_idx_collides(&pos) {
                    return Err(eyre!("pos idx collides"));
                }

                // Change infallibly after validation

                if let Some(old_parent) = self.parent(fid) {
                    self.feature_tree.remove_edge(old_parent, fid);
                }
                self.feature_tree.add_edge(pos.parent, fid, pos.idx);
            }
            self.feature_props
                .entry(fid)
                .or_default()
                .insert(k.clone(), v.cloned());
        }

        for (lid, k, v) in change.iter_lprops() {
            if k == "idx" {
                // Validate

                let idx = if let Some(v) = v.cloned() {
                    let idx: FracIdx = serde_json::from_value(v.clone())?;
                    if self.layer_idx_collides(&idx) {
                        return Err(eyre!("layer idx collides"));
                    }
                    Some(idx)
                } else {
                    None
                };

                // Change infallibly after validation

                self.layer_order.retain(|(_, other_id)| other_id != &lid);
                if let Some(idx) = idx {
                    self.layer_order.insert((idx, lid));
                }
            }
            self.layer_props
                .entry(lid)
                .or_default()
                .insert(k.clone(), v.cloned());
        }

        for fid in change.deleted_features() {
            self.feature_tree.remove_node(*fid);
            self.feature_props.remove(fid);
            self.deleted_features.insert(*fid);
        }

        Ok(())
    }

    #[tracing::instrument(skip(self))]
    fn is_feature_parent_invalid(&self, fid: Fid, parent: Fid) -> bool {
        let mut ancestor = parent;
        loop {
            if ancestor == Fid::FEATURE_ROOT {
                break false;
            }

            if ancestor == fid {
                tracing::info!("feature parent would loop");
                break true;
            }

            match self.parent(ancestor) {
                Some(p) => ancestor = p,
                None => {
                    tracing::info!("expected feature to have ancestor: {}", ancestor);
                    break true;
                }
            }
        }
    }

    /// If `pos` is changed adds a reply to `cset`. (Does not change bcast)
    fn validate_and_fix_feature_pos(
        &mut self,
        fid: Fid,
        pos: &mut Pos,
        cset: &mut Changeset,
    ) -> eyre::Result<()> {
        if self.is_feature_parent_invalid(fid, pos.parent) {
            tracing::info!("feature parent invalid: reparenting at root");

            *pos = Pos {
                parent: Fid::FEATURE_ROOT,
                idx: self.idx_for_last_in(Fid::FEATURE_ROOT),
            };

            cset.reply_only
                .set_fprop(fid, "pos", Some(serde_json::to_value(&pos)?));
        }

        if let Some(fixed_idx) = self.feature_idx_collision_fix(pos) {
            tracing::info!(
                "idx collision, fixed from {:?} to {:?}",
                &pos.idx,
                &fixed_idx
            );

            pos.idx = fixed_idx;

            cset.reply_only
                .set_fprop(fid, "pos", Some(serde_json::to_value(&pos)?));
        }

        Ok(())
    }

    fn pos_idx_collides(&self, pos: &Pos) -> bool {
        self.feature_tree
            .edges(pos.parent)
            .any(|(_, _, peer_idx)| peer_idx == &pos.idx)
    }

    fn feature_idx_collision_fix(&mut self, pos: &Pos) -> Option<FracIdx> {
        if self.pos_idx_collides(pos) {
            return None;
        }

        let after = self
            .feature_tree
            .edges(pos.parent)
            .map(|(_, _, idx)| idx)
            .filter(|idx| idx > &&pos.idx)
            .min();

        let fix = frac_idx::between(&mut self.rng, Some(&pos.idx), after);

        Some(fix)
    }

    fn layer_idx_collides(&self, idx: &FracIdx) -> bool {
        self.layer_order
            .iter()
            .any(|(other_idx, _)| other_idx == idx)
    }

    fn layer_idx_collision_fix(&mut self, idx: &FracIdx) -> Option<FracIdx> {
        if !self.layer_idx_collides(idx) {
            return None;
        }

        let after = self
            .layer_order
            .iter()
            .map(|(idx, _)| idx)
            .filter(|other_idx| other_idx > &idx)
            .min();

        let fix = frac_idx::between(&mut self.rng, Some(idx), after);

        Some(fix)
    }

    fn build_recursive_deletion(&mut self, id: Fid, changeset: &mut Changeset) {
        // TODO: How should this work? We need to converge
        // maybe the server should reparent orphans.
        // when could orphans exist?
        let children = self
            .feature_tree
            .edges(id)
            .map(|(_, child, _)| child)
            .collect::<Vec<_>>();
        for child in children {
            self.build_recursive_deletion(child, changeset);
        }
        changeset.change.add_fdelete(id);
    }

    fn parent(&self, id: Fid) -> Option<Fid> {
        self.feature_tree
            .edges_directed(id, Incoming)
            .next()
            .map(|(parent, _, _)| parent)
    }

    fn idx_for_last_in(&mut self, parent: Fid) -> FracIdx {
        let last = self
            .feature_tree
            .edges(parent)
            .map(|(_, _child, idx)| idx)
            .max();
        frac_idx::between(&mut self.rng, last, None)
    }

    pub fn dbg_tree(&self) -> String {
        petgraph::dot::Dot::new(&self.feature_tree).to_string()
    }

    pub fn dbg_object(&self, obj: Fid) -> String {
        if !self.feature_tree.contains_node(obj) {
            return "not found".to_string();
        }

        if let Some(props) = self.feature_props.get(&obj) {
            match serde_json::to_string_pretty(props) {
                Ok(s) => s,
                Err(e) => format!("{:?}", e),
            }
        } else {
            "{}".to_string()
        }
    }
}

#[cfg(test)]
mod tests {
    #[allow(unused_imports)]
    use pretty_assertions::{assert_eq, assert_ne};

    // use super::*;

    // fn dbg_tree<S: Store>(label: impl AsRef<str>, engine: &Engine<S>) {
    //     let path = std::env::temp_dir().join(format!("dbg_tree_{}.dot", rand::random::<u64>()));
    //     std::fs::write(&path, engine.dbg_tree()).unwrap();
    //     eprintln!("Wrote tree {} to {}", label.as_ref(), path.display());
    // }
}

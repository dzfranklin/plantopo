#![feature(buf_read_has_data_left)]

mod change;
pub mod fid;
pub mod frac_idx;
pub mod lid;
mod op;
pub mod store;

pub use self::{
    change::Change,
    fid::Fid,
    lid::Lid,
    op::{FCreateProps, Op},
};

use std::collections::{BTreeSet, HashMap, HashSet};

use eyre::{eyre, Context};
use petgraph::{
    prelude::*,
    visit::{depth_first_search, DfsEvent},
};
use rand::{rngs::SmallRng, SeedableRng};
use serde::{Deserialize, Serialize};
use serde_json::{from_value, to_value, Value};

use crate::{
    frac_idx::FracIdx,
    store::{NullStore, Store},
};

type Key = String;

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FPos {
    pub parent: Fid,
    pub idx: FracIdx,
}

#[derive(Debug)]
pub struct Engine<S> {
    store: S,
    rng: SmallRng,
    ftree: DiGraphMap<Fid, FracIdx>,
    fprops: PropMap<Fid>,
    fdeletes: HashSet<Fid>,
    lorder: BTreeSet<(FracIdx, Lid)>,
    lprops: PropMap<Lid>,
}

type PropMap<Id> = HashMap<Id, HashMap<String, Value>>;

#[derive(Debug, Clone, PartialEq, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChangeReply {
    /// To send to the client who sent us the op.
    pub reply_only: Change,
    /// To send to all other clients.
    pub change: Change,
}

impl<S> Default for Engine<S>
where
    S: Store + Default,
{
    fn default() -> Self {
        Self::new(S::default())
    }
}

impl<S> Engine<S>
where
    S: Store,
{
    #[tracing::instrument(skip(store))]
    pub fn new(store: S) -> Self {
        let mut ftree = DiGraphMap::new();
        ftree.add_node(Fid::ROOT);

        let root_pos = to_value(FPos {
            parent: Fid::ROOT,
            idx: FracIdx::default(),
        })
        .unwrap();

        let mut fprops = PropMap::<Fid>::new();
        fprops.insert(Fid::ROOT, HashMap::from_iter([("pos".into(), root_pos)]));

        Self {
            store,
            rng: SmallRng::from_entropy(),
            ftree,
            fprops,
            fdeletes: HashSet::new(),
            lorder: BTreeSet::new(),
            lprops: PropMap::new(),
        }
    }

    /// Strictly validates `snapshot` without trying fixes since it should be
    /// valid by our construction.
    #[tracing::instrument(skip(store))]
    pub fn load(store: S, snapshot: Change) -> eyre::Result<Self> {
        let mut engine = Self::new(store);

        // Assert load's assumptions about how new works
        {
            assert!(engine.ftree.contains_node(Fid::ROOT));
            assert_eq!(engine.ftree.node_count(), 1);
            assert_eq!(engine.ftree.edge_count(), 0);

            assert_eq!(engine.fprops.len(), 1);
            let root_props = engine.fprops.get(&Fid::ROOT).unwrap();
            assert!(root_props.contains_key("pos"));
            assert_eq!(root_props.len(), 1);

            assert_eq!(engine.fdeletes.len(), 0);

            assert!(engine.lorder.is_empty());

            assert!(engine.lprops.is_empty());
        }

        // Construct: fdeletes
        engine.fdeletes = snapshot.fdeletes;

        for ((fid, k), v) in snapshot.fprops {
            // Check: Not deleted
            if engine.fdeletes.contains(&fid) {
                return Err(eyre!("has prop for deleted fid {fid}"));
            }

            // Construct: fprops
            engine.fprops.entry(fid).or_default().insert(k, v);
        }
        for ((lid, k), v) in snapshot.lprops {
            // Construct: lprops
            engine.lprops.entry(lid).or_default().insert(k, v);
        }

        // Check: Root present
        if !engine.fprops.contains_key(&Fid::ROOT) {
            return Err(eyre!("root not present"));
        }

        for (&fid, props) in &engine.fprops {
            // Check: not deleted
            if engine.fdeletes.contains(&fid) {
                return Err(eyre!("has prop for deleted feature"));
            }

            // Check: pos property present and has valid shape
            let pos = props
                .get("pos")
                .ok_or_else(|| eyre!("pos prop missing for {fid}"))?;
            let pos: FPos = from_value(pos.clone()).wrap_err("invalid pos")?;

            if fid == Fid::ROOT {
                // Check: root has correct pos
                if pos.parent != Fid::ROOT || pos.idx != FracIdx::default() {
                    return Err(eyre!("invalid root pos"));
                }
            }

            // Check: parent fid exists
            if !engine.fprops.contains_key(&pos.parent) {
                return Err(eyre!("nonexistent parent for {fid}"));
            }

            if fid != Fid::ROOT {
                // Construct ftree
                engine.ftree.add_edge(pos.parent, fid, pos.idx);
            }
        }

        // Check: no siblings with the same idx
        let mut sibs_seen = HashSet::new();
        for fid in engine.fprops.keys().copied() {
            sibs_seen.clear();
            for (_, _child, idx) in engine.ftree.edges(fid) {
                if sibs_seen.contains(idx) {
                    return Err(eyre!("{fid} has chilren with duplicate indices"));
                }
                sibs_seen.insert(idx);
            }
        }

        // Check: ftree is a tree and every fid is reachable from the root
        let mut unreached = HashSet::<_>::from_iter(engine.ftree.nodes());
        assert!(&engine.ftree.contains_node(Fid::ROOT)); // Critical because otherwise we'll check nothing
        depth_first_search(&engine.ftree, [Fid::ROOT], |event| match event {
            DfsEvent::Discover(n, _) => {
                unreached.remove(&n);
                Ok(())
            }
            DfsEvent::TreeEdge(_, _) => Ok(()),
            DfsEvent::BackEdge(a, b) => Err(eyre!("back edge {a} -> {b}")),
            DfsEvent::CrossForwardEdge(a, b) => Err(eyre!("cross or forward edge {a} -> {b}")),
            DfsEvent::Finish(_, _) => Ok(()),
        })
        .wrap_err("would have invalid ftree")?;
        if !unreached.is_empty() {
            return Err(eyre!(
                "would have invalid ftree: unreachable nodes: {:?}",
                unreached
            ));
        }

        for (&lid, props) in &engine.lprops {
            // Check: idx property has valid shape if present
            let idx = if let Some(idx) = props.get("idx") {
                from_value::<Option<FracIdx>>(idx.clone()).wrap_err("invalid idx")?
            } else {
                None
            };

            if let Some(idx) = idx {
                // Construct: lorder
                engine.lorder.insert((idx, lid));
            }
        }

        // Check: no layers with the same idx
        let mut prev = None;
        for (idx, _lid) in &engine.lorder {
            if let Some(prev) = prev {
                if idx == prev {
                    return Err(eyre!("duplicate layer idx"));
                }
            }
            prev = Some(idx);
        }

        Ok(engine)
    }

    pub fn to_snapshot(&self) -> Change {
        let mut snapshot = Change::default();
        for (&fid, props) in &self.fprops {
            for (k, v) in props {
                snapshot.fset(fid, k.clone(), v.clone());
            }
        }
        for (&lid, props) in &self.lprops {
            for (k, v) in props {
                snapshot.lset(lid, k.clone(), v.clone());
            }
        }
        for &fid in &self.fdeletes {
            snapshot.fdelete(fid);
        }
        snapshot
    }

    #[tracing::instrument(skip(self))]
    pub fn expensive_consistency_check(&self) -> eyre::Result<()> {
        // Check that if we rebuilt ourselves from a snapshot of just (fprops,
        // lprops, fdeletes) we'd have identical fields.
        //
        // This checks that the materialized fields (ftree, lorder) properly
        // match the props they're derived from.
        //
        // This checks that the incremental validations we've done didn't miss
        // something the non-incremental validations in Self::load catch.

        let snapshot = self.to_snapshot();

        let rebuilt =
            Engine::load(NullStore, snapshot).wrap_err("load from to_snapshot would fail")?;

        // This ensures that if we add a field to Engine we get a build error
        // telling us to account for it here.
        let Engine {
            store: _,
            rng: _,
            ftree: rebuilt_ftree,
            fprops: rebuilt_fprops,
            fdeletes: rebuilt_fdeletes,
            lorder: rebuilt_lorder,
            lprops: rebuilt_lprops,
        } = &rebuilt;

        // I implemented nicer diagnostics ftree errors because it flowed from
        // the checks I needed anyway and I think that's the more likely bug.

        // Check: ftree
        for our_fid in self.ftree.nodes() {
            if !rebuilt_ftree.contains_node(our_fid) {
                return Err(eyre!(
                    "ftree would be missing {our_fid} if rebuilt from snapshot"
                ));
            }
        }
        for rebuilt_fid in rebuilt_ftree.nodes() {
            if !self.ftree.contains_node(rebuilt_fid) {
                return Err(eyre!(
                    "ftree would gain {rebuilt_fid} if rebuilt from snapshot"
                ));
            }
        }
        for (our_parent, our_child, our_idx) in self.ftree.all_edges() {
            if let Some(rebuilt_idx) = rebuilt_ftree.edge_weight(our_parent, our_child) {
                if rebuilt_idx != our_idx {
                    return Err(eyre!("ftree edge {our_parent} -> {our_child} would have a different idx if rebuilt from snapshot"));
                }
            } else {
                return Err(eyre!(
                    "ftree would be missing edge {our_parent} -> {our_child} if rebuilt from snapshot"
                ));
            }
        }
        for (rebuilt_parent, rebuilt_child, _) in rebuilt_ftree.all_edges() {
            if !self.ftree.contains_edge(rebuilt_parent, rebuilt_child) {
                return Err(eyre!("ftree would gain edge {rebuilt_parent} -> {rebuilt_child} if rebuilt from snapshot"));
            }
            // If the edge is in both we checked the weight in the preceding
            // loop over our edges
        }

        // Check: fprops
        if rebuilt_fprops != &self.fprops {
            return Err(eyre!("fprops would differ if rebuilt from snapshot"));
        }

        // Check: fdeletes
        if rebuilt_fdeletes != &self.fdeletes {
            return Err(eyre!("fdeletes would differ if rebuilt from snapshot"));
        }

        // Check: lorder
        if rebuilt_lorder != &self.lorder {
            return Err(eyre!("lorder would differ if rebuilt from snapshot"));
        }

        // Check: lprops
        if rebuilt_lprops != &self.lprops {
            return Err(eyre!("lprops would differ if rebuilt from snapshot"));
        }

        Ok(())
    }

    pub fn store(&self) -> &S {
        &self.store
    }

    pub fn store_mut(&mut self) -> &mut S {
        &mut self.store
    }

    pub fn apply(&mut self, validate_by: u16, ops: Vec<Op>) -> eyre::Result<ChangeReply> {
        let mut creply = ChangeReply::default();

        for op in ops {
            match op {
                Op::FCreate { fid, props } => {
                    if self.ftree.contains_node(fid) {
                        return Err(eyre!("oid already exists: {}", fid));
                    }
                    if self.fdeletes.contains(&fid) {
                        return Err(eyre!("oid deleted: {}", fid));
                    }
                    if !self.ftree.contains_node(props.pos.parent) {
                        return Err(eyre!("parent oid not found: {}", props.pos.parent));
                    }
                    if fid.client() != validate_by {
                        return Err(eyre!("tried to create feature with different oid client: got {fid}, expected client={validate_by}"));
                    }

                    let mut all_props = props.rest.clone();

                    let mut pos = props.pos;
                    self.validate_and_fix_feature_pos(fid, &mut pos, &mut creply)?;
                    self.ftree.add_edge(pos.parent, fid, pos.idx.clone());
                    all_props.insert("pos".to_string(), to_value(pos)?);

                    for (k, v) in &all_props {
                        creply.change.fset(fid, k.clone(), v.clone());
                    }
                    self.fprops.insert(fid, all_props);
                }
                Op::FDelete { fids } => {
                    self.fdelete(fids, &mut creply);
                }
                Op::FSet {
                    fid,
                    key,
                    mut value,
                } => {
                    if !self.ftree.contains_node(fid) {
                        return Err(eyre!("oid not found in tree: {}", fid));
                    }

                    if key == "pos" {
                        // This ensures "pos" is always set to something valid
                        let mut pos: FPos =
                            from_value(value).wrap_err("invalid pos value for feature")?;

                        self.validate_and_fix_feature_pos(fid, &mut pos, &mut creply)?;
                        value = to_value(&pos)?;

                        let old_parent = self.parent(fid).expect("parent required");
                        if old_parent == pos.parent {
                            let place = self
                                .ftree
                                .edge_weight_mut(old_parent, fid)
                                .expect("parent->child required");
                            *place = pos.idx;
                        } else {
                            self.ftree.remove_edge(old_parent, fid);
                            self.ftree.add_edge(pos.parent, fid, pos.idx);
                        }
                    }

                    creply.change.fset(fid, key.clone(), value.clone());
                    self.fprops
                        .get_mut(&fid)
                        .expect("fid missing from fprops")
                        .insert(key.clone(), value.clone());
                }
                Op::LSet {
                    lid,
                    key,
                    mut value,
                } => {
                    if key == "idx" {
                        let idx: Option<FracIdx> =
                            from_value(value.clone()).wrap_err("invalid idx")?;

                        self.lorder.retain(|(_, other_id)| other_id != &lid);

                        if let Some(mut idx) = idx {
                            if let Some(fixed_idx) = self.layer_idx_collision_fix(&idx) {
                                value = to_value(&fixed_idx)?;
                                idx = fixed_idx;

                                creply.reply_only.lset(lid, key.clone(), value.clone());
                            }
                            self.lorder.insert((idx, lid));
                        }
                    }

                    creply.change.lset(lid, key.clone(), value.clone());
                    self.lprops
                        .entry(lid)
                        .or_default()
                        .insert(key.clone(), value.clone());
                }
            }
        }

        self.store.push(creply.change.clone())?;

        Ok(creply)
    }

    #[tracing::instrument(skip(self))]
    fn fdelete(&mut self, incoming: HashSet<Fid>, outgoing: &mut ChangeReply) {
        if incoming.is_empty() {
            return;
        }

        depth_first_search(&self.ftree, incoming.iter().copied(), |event| {
            if let DfsEvent::Finish(descendant, _) = event {
                if !incoming.contains(&descendant) {
                    outgoing.reply_only.fdelete(descendant);
                }
            }
        });

        for &fid in &outgoing.change.fdeletes {
            self.fdeletes.insert(fid);
            self.ftree.remove_node(fid);
            self.fprops.remove(&fid);
        }
    }

    #[tracing::instrument(skip(self))]
    fn is_feature_parent_invalid(&self, fid: Fid, parent: Fid) -> bool {
        if !self.ftree.contains_node(parent) {
            tracing::info!("feature parent not in tree");
            return true;
        }

        let mut ancestor = parent;
        loop {
            if ancestor == Fid::ROOT {
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

    /// If `pos` is changed adds a reply to `creply`. (Does not change bcast)
    fn validate_and_fix_feature_pos(
        &mut self,
        fid: Fid,
        pos: &mut FPos,
        creply: &mut ChangeReply,
    ) -> eyre::Result<()> {
        if self.is_feature_parent_invalid(fid, pos.parent) {
            tracing::info!("feature parent invalid: reparenting at root");

            *pos = FPos {
                parent: Fid::ROOT,
                idx: self.idx_for_last_in(Fid::ROOT),
            };

            creply.reply_only.fset(fid, "pos", to_value(&pos)?);
        }

        if let Some(fixed_idx) = self.feature_idx_collision_fix(pos) {
            tracing::info!(
                "idx collision, fixed from {:?} to {:?}",
                &pos.idx,
                &fixed_idx
            );

            pos.idx = fixed_idx;

            creply.reply_only.fset(fid, "pos", to_value(&pos)?);
        }

        Ok(())
    }

    fn pos_idx_collides(&self, pos: &FPos) -> bool {
        self.ftree
            .edges(pos.parent)
            .any(|(_, _, peer_idx)| peer_idx == &pos.idx)
    }

    fn feature_idx_collision_fix(&mut self, pos: &FPos) -> Option<FracIdx> {
        if self.pos_idx_collides(pos) {
            return None;
        }

        let after = self
            .ftree
            .edges(pos.parent)
            .map(|(_, _, idx)| idx)
            .filter(|idx| idx > &&pos.idx)
            .min();

        let fix = frac_idx::between(&mut self.rng, Some(&pos.idx), after);

        Some(fix)
    }

    fn layer_idx_collides(&self, idx: &FracIdx) -> bool {
        self.lorder.iter().any(|(other_idx, _)| other_idx == idx)
    }

    fn layer_idx_collision_fix(&mut self, idx: &FracIdx) -> Option<FracIdx> {
        if !self.layer_idx_collides(idx) {
            return None;
        }

        let after = self
            .lorder
            .iter()
            .map(|(idx, _)| idx)
            .filter(|other_idx| other_idx > &idx)
            .min();

        let fix = frac_idx::between(&mut self.rng, Some(idx), after);

        Some(fix)
    }

    fn parent(&self, id: Fid) -> Option<Fid> {
        if id == Fid::ROOT {
            return Some(Fid::ROOT);
        }

        self.ftree
            .edges_directed(id, Incoming)
            .next()
            .map(|(parent, _, _)| parent)
    }

    fn idx_for_last_in(&mut self, parent: Fid) -> FracIdx {
        let last = self.ftree.edges(parent).map(|(_, _child, idx)| idx).max();
        frac_idx::between(&mut self.rng, last, None)
    }

    pub fn dbg_tree(&self) -> String {
        petgraph::dot::Dot::new(&self.ftree).to_string()
    }

    pub fn dbg_object(&self, obj: Fid) -> String {
        if !self.ftree.contains_node(obj) {
            return "not found".to_string();
        }

        if let Some(props) = self.fprops.get(&obj) {
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

package stores

import (
	"fmt"
	"math/rand"
	"sort"

	schema "github.com/danielzfranklin/plantopo/api/sync_schema"
	"go.uber.org/zap"
)

// Store is not thread-safe.
type Store struct {
	rng             *rand.Rand
	mapId           string
	layers          map[string]*schema.Layer
	layerOrder      map[string]*schema.Layer // by idx
	deletedFeatures map[string]struct{}
	features        map[string]*fnode
	ftree           *fnode
}

type fnode struct {
	id       string
	parent   *fnode
	children map[string]*fnode // by idx
	value    *schema.Feature
}

func New(mapId string, snapshot schema.Changeset) (*Store, error) {
	l := zap.L().Named("store.Load").With(zap.String("mapId", mapId))

	rngSource := rand.NewSource(0xdeadbeef) // arbitrary constant
	rng := rand.New(rngSource)

	store := &Store{
		rng:             rng,
		mapId:           mapId,
		layers:          make(map[string]*schema.Layer),
		layerOrder:      make(map[string]*schema.Layer),
		deletedFeatures: make(map[string]struct{}),
		features:        make(map[string]*fnode),
	}
	root := &fnode{
		id:       "",
		children: make(map[string]*fnode),
		value:    &schema.Feature{Id: ""},
	}
	store.ftree = root
	store.features[""] = root

	fixes, err := store.Update(l, &snapshot)
	if err != nil {
		return nil, err
	}
	if fixes != nil {
		return nil, fmt.Errorf("stored changset shouldn't require fixes")
	}

	return store, nil
}

func (s *Store) Snapshot() schema.Changeset {
	out := schema.Changeset{}
	if len(s.deletedFeatures) > 0 {
		out.FDelete = make(map[string]struct{}, len(s.deletedFeatures))
		for id := range s.deletedFeatures {
			out.FDelete[id] = struct{}{}
		}
	}
	if len(s.features) > 1 { // root is always there
		out.FAdd = make([]string, 0, len(s.features))
		out.FSet = make(map[string]schema.Feature, len(s.features))
		s.ftree.snapshotFAddOrder(&out.FAdd)
		for id, feature := range s.features {
			if id == "" {
				continue
			}
			out.FSet[id] = feature.value.ShallowClone()
		}
	}
	if len(s.layers) > 0 {
		out.LSet = make(map[string]schema.Layer, len(s.layers))
		for id, layer := range s.layers {
			out.LSet[id] = layer.ShallowClone()
		}
	}
	return out
}

func (n *fnode) snapshotFAddOrder(out *[]string) {
	indices := make([]string, 0, len(n.children))
	for idx := range n.children {
		indices = append(indices, idx)
	}
	sort.Strings(indices) // for determinism
	for _, idx := range indices {
		child := n.children[idx]
		*out = append(*out, child.id)
		child.snapshotFAddOrder(out)
	}
}

// Returns fixes for values in change inconsistent with the store.
func (s *Store) Update(l *zap.Logger, change *schema.Changeset) (*schema.Changeset, error) {
	// Note: The atomic unit of change here is the layer/feature. If there are
	// errors in the changeset we can't end up with partial changes for any given
	// feature, but it's fine if some feature/layers were updated already.

	// Note: The changes we make need to be idempotent and deterministic.

	s.rng.Seed(0xdeadbeef) // make deterministic

	var fixes *schema.Changeset = nil

	s.deleteAll(change.FDelete, &fixes)

	added := make(map[string]struct{})
	for _, id := range change.FAdd {
		if _, ok := added[id]; ok {
			continue
		}
		incoming, ok := change.FSet[id]
		if !ok {
			return nil, fmt.Errorf("fadd not in fset")
		}
		if incoming.Id != id {
			return nil, fmt.Errorf("feature id doesn't match fset key")
		}
		if err := s.finsert(l, true, incoming, &fixes); err != nil {
			return nil, err
		}
		added[id] = struct{}{}
	}

	toFSet := make([]string, 0, len(change.FSet))
	for id := range change.FSet {
		if _, ok := added[id]; ok {
			continue
		}
		toFSet = append(toFSet, id)
	}
	sort.Strings(toFSet) // for determinism
	for _, id := range toFSet {
		incoming := change.FSet[id]
		if incoming.Id != id {
			return nil, fmt.Errorf("feature id doesn't match fset key")
		}
		if err := s.finsert(l, false, incoming, &fixes); err != nil {
			return nil, err
		}
	}

	toLSet := make([]string, 0, len(change.LSet))
	for id := range change.LSet {
		toLSet = append(toLSet, id)
	}
	sort.Strings(toLSet) // for determinism
	for _, id := range toLSet {
		incoming := change.LSet[id]
		if incoming.Id != id {
			return nil, fmt.Errorf("layer id doesn't match lset key")
		}
		if err := s.linsert(l, incoming, &fixes); err != nil {
			return nil, err
		}
	}

	return fixes, nil
}

func idxCollisionFix[V any](rng *rand.Rand, indexMap map[string]V, colliding string) string {
	peers := make([]string, 0, len(indexMap))
	for k := range indexMap {
		peers = append(peers, k)
	}
	sort.Strings(peers)

	i := sort.SearchStrings(peers, colliding)
	if i == len(peers) {
		panic("bug: no collision to fix")
	}

	before := peers[i]
	after := ""
	if i+1 < len(peers) {
		after = peers[i+1]
	}
	between, err := schema.IdxBetween(rng, before, after)
	if err != nil {
		panic("bug: invalid indices in store")
	}
	return between
}

func (s *Store) linsert(l *zap.Logger, incoming schema.Layer, fixes **schema.Changeset) error {
	id := incoming.Id
	layer := s.layers[id]
	hasPrevIdx := false
	prevIdx := ""
	if layer == nil {
		layer = &incoming
		s.layers[id] = layer
	} else {
		hasPrevIdx = layer.IdxState == schema.Set
		prevIdx = layer.Idx
		layer.Merge(incoming)
	}

	// update s.layerOrder
	hasIdx := layer.IdxState == schema.Set
	if hasIdx != hasPrevIdx || layer.Idx != prevIdx {
		if hasPrevIdx {
			delete(s.layerOrder, prevIdx)
		}
		if layer.IdxState == schema.Set {
			if _, ok := s.layerOrder[layer.Idx]; ok {
				l.Info("layer idx collision, fixing", zap.String("id", id))
				layer.Idx = idxCollisionFix(s.rng, s.layerOrder, layer.Idx)
				addFix(fixes, schema.Changeset{
					LSet: map[string]schema.Layer{
						id: {
							Id:       id,
							IdxState: schema.Set,
							Idx:      layer.Idx,
						},
					},
				})
			}
			s.layerOrder[layer.Idx] = layer
		}
	}
	return nil
}

func (s *Store) finsert(l *zap.Logger, isAdd bool, incoming schema.Feature, fixes **schema.Changeset) error {
	if incoming.Id == "" {
		return fmt.Errorf("cannot change root feature")
	}
	if incoming.ParentState == schema.Unset {
		return fmt.Errorf("cannot change parent to unset")
	}

	// If the idx is unset make it the first child of the specified parent
	if incoming.IdxState == schema.Unset {
		parent, ok := s.features[incoming.Parent]
		if !ok {
			return fmt.Errorf("parent not in store")
		}
		incoming.Idx = parent.idxBeforeFirstChild(s.rng)
		incoming.IdxState = schema.Set
	}

	id := incoming.Id
	feature := s.features[id]
	prevParent := ""
	prevIdx := ""
	if feature == nil {
		if !isAdd {
			return fmt.Errorf("unrecognized fset feature not in fadd")
		}
		if incoming.ParentState == schema.Unspecified || incoming.IdxState == schema.Unspecified {
			return fmt.Errorf("new feature must have parent and idx")
		}

		feature = &fnode{
			id:       id,
			parent:   nil, // filled in below
			children: make(map[string]*fnode),
			value:    &incoming,
		}
		// START MUTATING. can no longer reject
		s.features[id] = feature
	} else {
		if incoming.ParentState == schema.Set {
			if _, ok := s.features[incoming.Parent]; !ok {
				return fmt.Errorf("cannot change parent: parent id not in store")
			}
		}
		isAdd = false
		prevParent = feature.value.Parent
		prevIdx = feature.value.Idx
		// START MUTATING. can no longer reject
		feature.value.Merge(incoming)
	}

	// update s.ftree
	if isAdd || feature.value.Parent != prevParent || feature.value.Idx != prevIdx {
		if !isAdd {
			prevParentNode := s.features[prevParent]
			if prevParentNode == nil {
				panic("bug: parent node missing")
			}
			delete(prevParentNode.children, prevIdx)
		}

		parent := s.features[feature.value.Parent]
		if parent == nil {
			panic("bug: we check earlier in this func parent exists")
		}

		// fix cycle
		if s.wouldCycle(feature, parent) {
			// NOTE: Maybe we can figure out a better way to handle this, depending on
			// how likely it is
			l.Info("feature would cycle, reparenting to root",
				zap.String("id", id), zap.String("parent", parent.id))
			feature.value.Parent = ""
			feature.value.Idx = s.ftree.idxBeforeFirstChild(s.rng)
			parent = s.ftree
			addFix(fixes, schema.Changeset{
				FSet: map[string]schema.Feature{
					id: {
						Id:          id,
						ParentState: schema.Set,
						Parent:      "",
						IdxState:    schema.Set,
						Idx:         feature.value.Idx,
					},
				},
			})
		}

		// fix idx collision
		if _, ok := parent.children[feature.value.Idx]; ok {
			l.Info("feature idx collision, fixing",
				zap.String("id", id), zap.String("parent", parent.id))
			feature.value.Idx = idxCollisionFix(s.rng, parent.children, feature.value.Idx)
			addFix(fixes, schema.Changeset{
				FSet: map[string]schema.Feature{
					id: {
						Id:          id,
						ParentState: schema.Set,
						Parent:      feature.value.Parent,
						IdxState:    schema.Set,
						Idx:         feature.value.Idx,
					},
				},
			})
		}

		feature.parent = parent
		parent.children[feature.value.Idx] = feature
	}
	return nil
}

func (s *Store) deleteAll(incoming map[string]struct{}, fixes **schema.Changeset) {
	for id := range incoming {
		node, ok := s.features[id]
		if ok {
			// if we know the feature being deleted delete it and all its children
			s.deleteRecurse(node, &incoming, fixes)
		} else {
			// otherwise just record this feature was deleted
			s.deletedFeatures[id] = struct{}{}
		}
	}
}

func (s *Store) deleteRecurse(
	node *fnode,
	incoming *map[string]struct{},
	fixes **schema.Changeset, // out param
) {
	// if incoming didn't know about a child, add it to fixes
	if _, ok := (*incoming)[node.id]; !ok {
		addFix(fixes, schema.Changeset{
			FDelete: map[string]struct{}{node.id: {}},
		})
	}
	// change our state
	delete(node.parent.children, node.value.Idx)
	delete(s.features, node.id)
	s.deletedFeatures[node.id] = struct{}{}
	// recurse into children
	for _, child := range node.children {
		s.deleteRecurse(child, incoming, fixes)
	}
}

func (s *Store) wouldCycle(feature *fnode, parent *fnode) bool {
	for node := parent; node != nil; node = node.parent {
		if node.id == feature.id {
			return true
		}
	}
	return false
}

func (n *fnode) idxBeforeFirstChild(rng *rand.Rand) string {
	peers := make([]string, 0, len(n.children))
	for k := range n.children {
		peers = append(peers, k)
	}
	sort.Strings(peers)

	after := ""
	if len(peers) > 0 {
		after = peers[0]
	}
	between, err := schema.IdxBetween(rng, "", after)
	if err != nil {
		panic("bug: invalid indices in store")
	}
	return between
}

func addFix(fixes **schema.Changeset, f schema.Changeset) {
	if *fixes == nil {
		*fixes = &schema.Changeset{}
	}
	(*fixes).Merge(&f)
}

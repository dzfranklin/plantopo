package store

import (
	"bytes"
	"compress/gzip"
	"context"
	"encoding/json"
	"fmt"
	"sort"
	"sync"

	schema "github.com/danielzfranklin/plantopo/sync_schema"
	"github.com/google/uuid"
)

type Store struct {
	mu              sync.Mutex
	db              Db
	mapId           uuid.UUID
	layers          map[string]*schema.Layer
	layerOrder      map[string]*schema.Layer // by idx
	deletedFeatures map[string]struct{}
	features        map[string]*fnode
	ftree           *fnode
	hasUnsaved      bool
}

type fnode struct {
	id       string
	parent   *fnode
	children map[string]*fnode // by idx
	value    *schema.Feature
}

func Load(ctx context.Context, db Db, mapId uuid.UUID) (*Store, error) {
	value, err := db.GetMapSnapshot(ctx, mapId)
	if err != nil {
		return nil, err
	}
	snapshot := schema.Changeset{}
	if value != nil {
		snapshot, err = unmarshalSnapshot(value)
		if err != nil {
			return nil, err
		}
	}

	store := &Store{
		db:              db,
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

	fixes, err := store.Update(&snapshot)
	if err != nil {
		return nil, err
	}
	if fixes != nil {
		return nil, fmt.Errorf("stored changset shouldn't require fixes")
	}

	return store, nil
}

func (s *Store) ToSnapshot() schema.Changeset {
	s.mu.Lock()
	defer s.mu.Unlock()
	out := schema.Changeset{
		FDelete: make(map[string]struct{}, len(s.deletedFeatures)),
		FAdd:    make(map[string]struct{}, len(s.features)),
		FSet:    make(map[string]schema.Feature, len(s.features)),
		LSet:    make(map[string]schema.Layer, len(s.layers)),
	}
	for id := range s.deletedFeatures {
		out.FDelete[id] = struct{}{}
	}
	for id, feature := range s.features {
		if id == "" {
			continue
		}
		out.FAdd[id] = struct{}{}
		out.FSet[id] = *feature.value
	}
	for id, layer := range s.layers {
		out.LSet[id] = *layer
	}
	return out
}

// Returns fixes for values in change inconsistent with the store.
func (s *Store) Update(change *schema.Changeset) (*schema.Changeset, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	// Note: The atomic unit of change here is the layer/feature. If there are
	// errors in the changeset we can't end up with partial changes for any given
	// feature, but it's fine if some feature/layers were updated already.

	s.hasUnsaved = true
	var fixes *schema.Changeset

	s.deleteAllCallerLocks(change.FDelete, fixes)

	added := make(map[string]struct{})
	for id := range change.FAdd {
		incoming, ok := change.FSet[id]
		if !ok {
			return nil, fmt.Errorf("fadd not in fset")
		}
		if incoming.Id != id {
			return nil, fmt.Errorf("feature id doesn't match fset key")
		}
		if err := s.finsertCallerLocks(true, incoming, fixes); err != nil {
			return nil, err
		}
		added[id] = struct{}{}
	}

	for id, incoming := range change.FSet {
		if _, ok := added[incoming.Id]; ok {
			continue
		}
		if incoming.Id != id {
			return nil, fmt.Errorf("feature id doesn't match fset key")
		}
		if err := s.finsertCallerLocks(false, incoming, fixes); err != nil {
			return nil, err
		}
	}

	for id, incoming := range change.LSet {
		if incoming.Id != id {
			return nil, fmt.Errorf("layer id doesn't match lset key")
		}
		if err := s.linsertCallerLocks(incoming, fixes); err != nil {
			return nil, err
		}
	}

	return fixes, nil
}

func (s *Store) Save(ctx context.Context) error {
	if !s.hasUnsaved {
		return nil
	}
	// ToSnapshot does the locking we need here
	snapshot := s.ToSnapshot()
	value, err := marshalSnapshot(snapshot)
	if err != nil {
		return err
	}
	s.hasUnsaved = false
	return s.db.SetMapSnapshot(ctx, s.mapId, value)
}

func idxCollisionFix[V any](indexMap map[string]V, colliding string) string {
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
	between, err := schema.IdxBetween(before, after)
	if err != nil {
		panic("bug: invalid indices in store")
	}
	return between
}

func (s *Store) linsertCallerLocks(incoming schema.Layer, fixes *schema.Changeset) error {
	id := incoming.Id
	layer := s.layers[id]
	hasPrevIdx := false
	prevIdx := ""
	if layer == nil {
		layer = &incoming
		s.layers[id] = layer
	} else {
		hasPrevIdx = layer.IdxState != schema.Unspecified
		prevIdx = layer.Idx
		layer.Merge(incoming)
	}

	// update s.layerOrder
	hasIdx := layer.IdxState != schema.Unspecified
	if hasIdx != hasPrevIdx || layer.Idx != prevIdx {
		if hasPrevIdx {
			delete(s.layerOrder, prevIdx)
		}
		if _, ok := s.layerOrder[layer.Idx]; ok {
			layer.Idx = idxCollisionFix(s.layerOrder, layer.Idx)
			if fixes == nil {
				*fixes = schema.Changeset{}
			}
			fixes.LSet[id] = schema.Layer{Id: id, IdxState: schema.Set, Idx: layer.Idx}
		}
		s.layerOrder[layer.Idx] = layer
	}
	return nil
}

func (s *Store) finsertCallerLocks(isAdd bool, incoming schema.Feature, fixes *schema.Changeset) error {
	if incoming.Id == "" {
		return fmt.Errorf("cannot change root feature")
	}
	if incoming.ParentState == schema.Unset || incoming.IdxState == schema.Unset {
		return fmt.Errorf("cannot change parent or idx to unset")
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
		if _, ok := s.features[incoming.Parent]; !ok {
			return fmt.Errorf("parent of new feature not in store")
		}
		feature = &fnode{
			id:       id,
			parent:   nil,
			children: make(map[string]*fnode),
			value:    &incoming,
		}
		s.features[id] = feature
	} else {
		if incoming.ParentState == schema.Set {
			if _, ok := s.features[incoming.Parent]; !ok {
				return fmt.Errorf("cannot change parent: parent id not in store")
			}
		}
		prevParent = feature.value.Parent
		prevIdx = feature.value.Idx
		feature.value.Merge(incoming)
	}

	// update s.ftree
	if feature.value.Parent != prevParent || feature.value.Idx != prevIdx {
		prevParentNode := s.features[prevParent]
		if prevParentNode == nil {
			panic("bug: parent node missing")
		}
		delete(prevParentNode.children, prevIdx)

		parentNode := s.features[feature.value.Parent]
		if parentNode == nil {
			panic("bug: we check earlier in this func parent exists")
		}
		if _, ok := parentNode.children[feature.value.Idx]; ok {
			feature.value.Idx = idxCollisionFix(parentNode.children, feature.value.Idx)
			if fixes == nil {
				*fixes = schema.Changeset{}
			}
			fixes.FSet[id] = schema.Feature{Id: id, IdxState: schema.Set, Idx: feature.value.Idx}
		}
		parentNode.children[feature.value.Idx] = feature
	}
	return nil
}

func (s *Store) deleteAllCallerLocks(incoming map[string]struct{}, fixes *schema.Changeset) {
	for id := range incoming {
		node, ok := s.features[id]
		if ok {
			// if we know the feature being deleted delete it and all its children
			s.deleteRecurseCallerLocks(node, &incoming, fixes)
		} else {
			// otherwise just record this feature was deleted
			s.deletedFeatures[id] = struct{}{}
		}
	}
}

func (s *Store) deleteRecurseCallerLocks(
	node *fnode,
	incoming *map[string]struct{},
	fixes *schema.Changeset, // out param
) {
	// if incoming didn't know about a child, add it to fixes
	if _, ok := (*incoming)[node.id]; !ok {
		if fixes == nil {
			*fixes = schema.Changeset{}
		}
		fixes.FDelete[node.id] = struct{}{}
	}
	// change our state
	delete(node.parent.children, node.value.Idx)
	delete(s.features, node.id)
	s.deletedFeatures[node.id] = struct{}{}
	// recurse into children
	for _, child := range node.children {
		s.deleteRecurseCallerLocks(child, incoming, fixes)
	}
}

func marshalSnapshot(snapshot schema.Changeset) ([]byte, error) {
	uncompressed, err := json.Marshal(snapshot)
	if err != nil {
		return nil, err
	}
	var compressed bytes.Buffer
	writer := gzip.NewWriter(&compressed)
	_, err = writer.Write(uncompressed)
	if err != nil {
		return nil, err
	}
	err = writer.Close()
	if err != nil {
		return nil, err
	}
	return compressed.Bytes(), nil
}

func unmarshalSnapshot(value []byte) (schema.Changeset, error) {
	reader, err := gzip.NewReader(bytes.NewReader(value))
	if err != nil {
		return schema.Changeset{}, err
	}
	var uncompressed bytes.Buffer
	_, err = uncompressed.ReadFrom(reader)
	if err != nil {
		return schema.Changeset{}, err
	}
	var snapshot schema.Changeset
	err = json.Unmarshal(uncompressed.Bytes(), &snapshot)
	if err != nil {
		return schema.Changeset{}, err
	}
	return snapshot, nil
}

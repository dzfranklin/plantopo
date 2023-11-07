package docstore

import (
	"fmt"
	schema "github.com/danielzfranklin/plantopo/api/sync_schema"
	"go.uber.org/zap"
	"math/rand"
	"slices"
	"sort"
	"sync"
)

type BadUpdateError struct {
	msg string
}

func (e BadUpdateError) Error() string {
	return fmt.Sprintf("bad changeset: %s", e.msg)
}

type docState struct {
	mu                       sync.RWMutex
	rng                      *rand.Rand
	g                        uint64
	fadds                    map[string]uint64
	fdeletes                 map[string]uint64
	ftree                    map[string]map[string]*schema.StoredFeature
	forphans                 map[string]*schema.StoredFeature
	findices                 map[string]map[string]*schema.StoredFeature
	fnodes                   map[string]*schema.StoredFeature
	lindices                 map[string]*schema.StoredLayer
	lnodes                   map[string]*schema.StoredLayer
	stableFindFeatureChanges bool // for testing
	l                        *zap.SugaredLogger
}

func newDocState(logger *zap.Logger, g uint64) *docState {
	s := &docState{
		rng:      rand.New(rand.NewSource(rand.Int63())),
		g:        g,
		fadds:    make(map[string]uint64),
		fdeletes: make(map[string]uint64),
		ftree:    make(map[string]map[string]*schema.StoredFeature),
		forphans: make(map[string]*schema.StoredFeature),
		findices: make(map[string]map[string]*schema.StoredFeature),
		fnodes:   make(map[string]*schema.StoredFeature),
		lindices: make(map[string]*schema.StoredLayer),
		lnodes:   make(map[string]*schema.StoredLayer),
		l:        logger.Sugar(),
	}
	s.fnodes[""] = &schema.StoredFeature{}
	return s
}

// ChangesAfter returns the current generation and a changeset of all changes after the given generation.
func (s *docState) ChangesAfter(generation uint64) (uint64, *schema.Changeset) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	if s.g == generation {
		return s.g, nil
	}

	out := &schema.Changeset{
		FAdd:    make([]string, 0),
		FDelete: make(map[string]struct{}),
		FSet:    make(map[string]*schema.Feature),
		LSet:    make(map[string]*schema.Layer),
	}
	for fid, deleteG := range s.fdeletes {
		if deleteG > generation {
			out.FDelete[fid] = struct{}{}
		}
	}
	s.findFeatureChanges(generation, "", out)
	for fid := range s.forphans {
		s.findFeatureChanges(generation, fid, out)
	}
	for lid, l := range s.lnodes {
		subset := l.ChangesSince(generation, lid)
		if subset != nil {
			out.LSet[lid] = subset
		}
	}

	if len(out.FAdd) == 0 {
		out.FAdd = nil
	}
	if len(out.FDelete) == 0 {
		out.FDelete = nil
	}
	if len(out.FSet) == 0 {
		out.FSet = nil
	}
	if len(out.LSet) == 0 {
		out.LSet = nil
	}
	if out.FAdd == nil && out.FDelete == nil && out.FSet == nil && out.LSet == nil {
		out = nil
	}

	return s.g, out
}

// findFeatureChanges add fadds and fsets to out for all changes to descendants of parent since generation.
//
// # Concurrency
//
// Caller must hold the read lock.
func (s *docState) findFeatureChanges(generation uint64, parent string, out *schema.Changeset) {
	// Note by searching recursively we ensure we fadd ancestors before their descendants.

	addG := s.fadds[parent]
	if addG > generation {
		out.FAdd = append(out.FAdd, parent)
		// if there are any other changes this will be overwritten
		out.FSet[parent] = &schema.Feature{Id: parent}
	}
	subset := s.fnodes[parent].ChangesSince(generation, parent)
	if subset != nil {
		out.FSet[parent] = subset
	}

	if s.stableFindFeatureChanges {
		childOrder := make([]string, 0, len(s.childrenOf(parent)))
		for child := range s.childrenOf(parent) {
			childOrder = append(childOrder, child)
		}
		slices.Sort(childOrder)
		for _, child := range childOrder {
			s.findFeatureChanges(generation, child, out)
		}
	} else {
		for child := range s.childrenOf(parent) {
			s.findFeatureChanges(generation, child, out)
		}
	}
}

// Update applies the given changeset to the docState.
func (s *docState) Update(change *schema.Changeset) (generation uint64, err error) {
	if change == nil {
		return
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	s.g++

	err = s.fdeleteAll(change.FDelete)
	if err != nil {
		return
	}

	for _, id := range change.FAdd {
		incoming, ok := change.FSet[id]
		if !ok {
			return 0, &BadUpdateError{"missing fset for fadd"}
		}
		err = s.fset(true, incoming)
		if err != nil {
			return
		}
	}
	added := stringSetOf(change.FAdd...)

	for id, incoming := range change.FSet {
		if added.has(id) {
			continue
		}
		err = s.fset(false, incoming)
		if err != nil {
			return
		}
	}

	for _, incoming := range change.LSet {
		err = s.lset(incoming)
		if err != nil {
			return
		}
	}

	return s.g, nil
}

func (s *docState) FastForward(generation uint64) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.g = max(s.g, generation)
}

// fdeleteAll deletes the given ids and all their known descendants.
//
// # Concurrency
//
// Caller must hold the write lock.
func (s *docState) fdeleteAll(incoming stringSet) (err error) {
	if len(incoming) == 0 {
		return
	}
	seen := stringSetOf()
	for fid := range incoming {
		err = s.fdeleteRecurse(fid, seen)
		if err != nil {
			return
		}
	}
	return
}

// fdeleteRecurse deletes the given entry and all its known descendants.
//
// # Concurrency
//
// Caller must hold the write lock.
func (s *docState) fdeleteRecurse(fid string, seen stringSet) (err error) {
	if fid == "" {
		return &BadUpdateError{"cannot delete root"}
	}
	if seen.has(fid) {
		return
	}
	seen.add(fid)

	s.fdeletes[fid] = s.g
	delete(s.fadds, fid)
	if f := s.fnodes[fid]; f != nil {
		delete(s.fnodes, fid)
		if f.ParentState == schema.Set {
			delete(s.ftree[f.Parent], fid)
			if f.IdxState == schema.Set {
				delete(s.findices[f.Parent], f.Idx)
			}
		} else {
			delete(s.forphans, fid)
		}
	}

	for child := range s.childrenOf(fid) {
		err = s.fdeleteRecurse(child, seen)
		if err != nil {
			return
		}
	}
	return
}

// fset applies incoming to the docState.
// # Concurrency
//
// Caller must hold the write lock.
func (s *docState) fset(isAdd bool, incoming *schema.Feature) (err error) {
	if incoming.Id == "" {
		if incoming.ParentState == schema.Set {
			return &BadUpdateError{"cannot set parent of root"}
		}
		if incoming.IdxState == schema.Set {
			return &BadUpdateError{"cannot set idx of root"}
		}
	}

	fid := incoming.Id
	f := s.fnodes[fid]
	if isAdd {
		if f == nil {
			s.fadds[fid] = s.g
			f = &schema.StoredFeature{}
			s.fnodes[fid] = f
		} else {
			isAdd = false
		}
	}
	if f == nil {
		return &BadUpdateError{"fset for unknown"}
	}

	prev := *f
	defer func() {
		if err != nil {
			if isAdd {
				delete(s.fadds, fid)
				delete(s.fnodes, fid)
			} else {
				s.fnodes[fid] = &prev
			}
		}
	}()

	f.Merge(s.g, incoming)

	var parent *schema.StoredFeature
	if f.ParentState == schema.Set {
		if f.Parent == fid {
			return &BadUpdateError{"parent cannot be self"}
		}
		parent = s.fnodes[f.Parent]
		if parent == nil {
			return &BadUpdateError{"parent missing"}
		}

		node := f
		for {
			if node.ParentState != schema.Set || node.Parent == "" {
				// reached orphan or root
				break
			}
			if node.Parent == fid {
				// detected cycle
				f.Parent = ""
				f.IdxState = schema.Unset
				break
			}
			node = s.fnodes[node.Parent]
		}
	}

	if f.ParentState == schema.Set && f.IdxState != schema.Set {
		f.Idx = s.idxBeforeFirstChildOf(f.Parent)
		f.IdxState = schema.Set
	}
	if f.IdxState == schema.Set && f.Idx == "" {
		return &BadUpdateError{"idx cannot be the empty string"}
	}

	// We don't update changes to ftree/forphans/findices in the defer above so
	// everything below this line needs to be infallible.

	if prev.ParentState == schema.Set {
		delete(s.ftree[prev.Parent], fid)
		if prev.IdxState == schema.Set {
			delete(s.findices[prev.Parent], prev.Idx)
		}
	} else {
		delete(s.forphans, fid)
	}
	if f.ParentState == schema.Set {
		peers := s.ftree[f.Parent]
		if peers == nil {
			peers = make(map[string]*schema.StoredFeature)
			s.ftree[f.Parent] = peers
		}
		peers[fid] = f
		if f.IdxState == schema.Set {
			indices := s.findices[f.Parent]
			if indices == nil {
				indices = make(map[string]*schema.StoredFeature)
				s.findices[f.Parent] = indices
			}
			if _, ok := indices[f.Idx]; ok {
				f.Idx, err = idxCollisionFix(s.rng, indices, f.Idx)
				if err != nil {
					s.l.DPanic("invalid idx in docState", zap.Error(err))
					f.Idx = schema.MustIdxBetween(s.rng, "", "")
					err = nil
				}
			}
			indices[f.Idx] = f
		}
	} else {
		s.forphans[fid] = f
	}

	return nil
}

// lset applies incoming to the docState.
// # Concurrency
//
// Caller must hold the write lock.
func (s *docState) lset(incoming *schema.Layer) (err error) {
	lid := incoming.Id
	l, ok := s.lnodes[lid]
	if !ok {
		l = &schema.StoredLayer{}
		s.lnodes[lid] = l
	}

	prev := *l
	defer func() {
		if err != nil {
			s.lnodes[lid] = &prev
		}
	}()

	l.Merge(s.g, incoming)

	// We don't update changes to lindices in the defer above so everything below this line needs to be infallible.
	if prev.IdxState == schema.Set {
		delete(s.lindices, prev.Idx)
	}
	if l.IdxState == schema.Set {
		if _, ok := s.lindices[l.Idx]; ok {
			l.Idx, err = idxCollisionFix(s.rng, s.lindices, l.Idx)
			if err != nil {
				s.l.DPanic("invalid idx in docState", zap.Error(err))
				l.Idx = schema.MustIdxBetween(s.rng, "", "")
				err = nil
			}
		}
		s.lindices[l.Idx] = l
	}

	return nil
}

// childrenOf returns a map of fid to feature for all children of the given feature.
func (s *docState) childrenOf(fid string) map[string]*schema.StoredFeature {
	return s.ftree[fid]
}

// idxBeforeFirstChildOf returns an idx that sorts before the first child of the given feature.
func (s *docState) idxBeforeFirstChildOf(fid string) string {
	peers := s.childrenOf(fid)
	first := ""
	for _, peer := range peers {
		if first == "" || peer.Idx < first {
			first = peer.Idx
		}
	}

	idx, err := schema.IdxBetween(s.rng, "", first)
	if err != nil {
		s.l.DPanic("invalid idx in docState", zap.Error(err))
		return schema.MustIdxBetween(s.rng, "", "")
	}
	return idx
}

func idxCollisionFix[V any](rng *rand.Rand, peerIndices map[string]V, colliding string) (string, error) {
	peers := make([]string, 0, len(peerIndices))
	for k := range peerIndices {
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
	return schema.IdxBetween(rng, before, after)
}

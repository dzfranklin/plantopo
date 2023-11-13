package docstore

import (
	"fmt"
	schema "github.com/danielzfranklin/plantopo/api/sync_schema"
	"go.uber.org/zap"
	"math/rand"
	"slices"
	"sort"
	"strings"
	"sync"
)

type BadUpdateError struct {
	msg string
}

func (e BadUpdateError) Error() string {
	return fmt.Sprintf("bad changeset: %s", e.msg)
}

type Doc struct {
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

func NewDoc(logger *zap.Logger) *Doc {
	s := &Doc{
		rng:      rand.New(rand.NewSource(rand.Int63())),
		g:        0,
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

// TraverseFeatures visits each live feature in depth-first order
func (d *Doc) TraverseFeatures(fn func(f schema.Feature)) {
	d.mu.RLock()
	defer d.mu.RUnlock()
	d.traverseFeaturesIn("", fn)
}

// TraverseFeaturesIn visits each descendent of parent in depth-first order
//
// # Concurrency
//
// Caller must hold the read lock.
func (d *Doc) traverseFeaturesIn(parent string, fn func(f schema.Feature)) {
	children := d.childrenOf(parent)
	order := make([]schema.Feature, 0, len(children))
	for fid, f := range children {
		if f.IdxState != schema.Set {
			continue
		}
		order = append(order, *f.ChangesSince(0, fid))
	}
	slices.SortFunc(order, func(a, b schema.Feature) int {
		return strings.Compare(a.Idx, b.Idx)
	})
	for _, f := range order {
		fn(f)
		d.traverseFeaturesIn(f.Id, fn)
	}
}

// ChangesAfter returns the current generation and a changeset of all changes after the given generation.
func (d *Doc) ChangesAfter(generation uint64) (uint64, *schema.Changeset) {
	d.mu.RLock()
	defer d.mu.RUnlock()

	if d.g == generation {
		return d.g, nil
	}

	out := &schema.Changeset{
		FAdd:    make([]string, 0),
		FDelete: make(map[string]struct{}),
		FSet:    make(map[string]*schema.Feature),
		LSet:    make(map[string]*schema.Layer),
	}
	for fid, deleteG := range d.fdeletes {
		if deleteG > generation {
			out.FDelete[fid] = struct{}{}
		}
	}
	d.findFeatureChanges(generation, "", out)
	for fid := range d.forphans {
		d.findFeatureChanges(generation, fid, out)
	}
	for lid, l := range d.lnodes {
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

	return d.g, out
}

// findFeatureChanges add fadds and fsets to out for all changes to descendants of parent since generation.
//
// # Concurrency
//
// Caller must hold the read lock.
func (d *Doc) findFeatureChanges(generation uint64, parent string, out *schema.Changeset) {
	// Note by searching recursively we ensure we fadd ancestors before their descendants.

	addG := d.fadds[parent]
	if addG > generation {
		out.FAdd = append(out.FAdd, parent)
		// if there are any other changes this will be overwritten
		out.FSet[parent] = &schema.Feature{Id: parent}
	}
	subset := d.fnodes[parent].ChangesSince(generation, parent)
	if subset != nil {
		out.FSet[parent] = subset
	}

	if d.stableFindFeatureChanges {
		childOrder := make([]string, 0, len(d.childrenOf(parent)))
		for child := range d.childrenOf(parent) {
			childOrder = append(childOrder, child)
		}
		slices.Sort(childOrder)
		for _, child := range childOrder {
			d.findFeatureChanges(generation, child, out)
		}
	} else {
		for child := range d.childrenOf(parent) {
			d.findFeatureChanges(generation, child, out)
		}
	}
}

// Update applies the given changeset to the Doc.
func (d *Doc) Update(change *schema.Changeset) (generation uint64, err error) {
	if change == nil {
		return
	}

	d.mu.Lock()
	defer d.mu.Unlock()

	d.g++

	err = d.fdeleteAll(change.FDelete)
	if err != nil {
		return
	}

	for _, id := range change.FAdd {
		incoming, ok := change.FSet[id]
		if !ok {
			return 0, &BadUpdateError{"missing fset for fadd"}
		}
		err = d.fset(true, incoming)
		if err != nil {
			return
		}
	}
	added := stringSetOf(change.FAdd...)

	for id, incoming := range change.FSet {
		if added.has(id) {
			continue
		}
		err = d.fset(false, incoming)
		if err != nil {
			return
		}
	}

	for _, incoming := range change.LSet {
		err = d.lset(incoming)
		if err != nil {
			return
		}
	}

	return d.g, nil
}

func (d *Doc) FastForward(generation uint64) {
	d.mu.Lock()
	defer d.mu.Unlock()
	d.g = max(d.g, generation)
}

// fdeleteAll deletes the given ids and all their known descendants.
//
// # Concurrency
//
// Caller must hold the write lock.
func (d *Doc) fdeleteAll(incoming stringSet) (err error) {
	if len(incoming) == 0 {
		return
	}
	seen := stringSetOf()
	for fid := range incoming {
		err = d.fdeleteRecurse(fid, seen)
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
func (d *Doc) fdeleteRecurse(fid string, seen stringSet) (err error) {
	if fid == "" {
		return &BadUpdateError{"cannot delete root"}
	}
	if seen.has(fid) {
		return
	}
	seen.add(fid)

	d.fdeletes[fid] = d.g
	delete(d.fadds, fid)
	if f := d.fnodes[fid]; f != nil {
		delete(d.fnodes, fid)
		if f.ParentState == schema.Set {
			delete(d.ftree[f.Parent], fid)
			if f.IdxState == schema.Set {
				delete(d.findices[f.Parent], f.Idx)
			}
		} else {
			delete(d.forphans, fid)
		}
	}

	for child := range d.childrenOf(fid) {
		err = d.fdeleteRecurse(child, seen)
		if err != nil {
			return
		}
	}
	return
}

// fset applies incoming to the Doc.
// # Concurrency
//
// Caller must hold the write lock.
func (d *Doc) fset(isAdd bool, incoming *schema.Feature) (err error) {
	if incoming.Id == "" {
		if incoming.ParentState == schema.Set {
			return &BadUpdateError{"cannot set parent of root"}
		}
		if incoming.IdxState == schema.Set {
			return &BadUpdateError{"cannot set idx of root"}
		}
	}

	fid := incoming.Id
	f := d.fnodes[fid]
	if isAdd {
		if f == nil {
			d.fadds[fid] = d.g
			f = &schema.StoredFeature{}
			d.fnodes[fid] = f
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
				delete(d.fadds, fid)
				delete(d.fnodes, fid)
			} else {
				d.fnodes[fid] = &prev
			}
		}
	}()

	f.Merge(d.g, incoming)

	var parent *schema.StoredFeature
	if f.ParentState == schema.Set {
		if f.Parent == fid {
			return &BadUpdateError{"parent cannot be self"}
		}
		parent = d.fnodes[f.Parent]
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
			node = d.fnodes[node.Parent]
		}
	}

	if f.ParentState == schema.Set && f.IdxState != schema.Set {
		f.Idx = d.idxBeforeFirstChildOf(f.Parent)
		f.IdxState = schema.Set
	}
	if f.IdxState == schema.Set && f.Idx == "" {
		return &BadUpdateError{"idx cannot be the empty string"}
	}

	// We don't update changes to ftree/forphans/findices in the defer above so
	// everything below this line needs to be infallible.

	if prev.ParentState == schema.Set {
		delete(d.ftree[prev.Parent], fid)
		if prev.IdxState == schema.Set {
			delete(d.findices[prev.Parent], prev.Idx)
		}
	} else {
		delete(d.forphans, fid)
	}
	if f.ParentState == schema.Set {
		peers := d.ftree[f.Parent]
		if peers == nil {
			peers = make(map[string]*schema.StoredFeature)
			d.ftree[f.Parent] = peers
		}
		peers[fid] = f
		if f.IdxState == schema.Set {
			indices := d.findices[f.Parent]
			if indices == nil {
				indices = make(map[string]*schema.StoredFeature)
				d.findices[f.Parent] = indices
			}
			if _, ok := indices[f.Idx]; ok {
				f.Idx, err = idxCollisionFix(d.rng, indices, f.Idx)
				if err != nil {
					d.l.DPanic("invalid idx in Doc", zap.Error(err))
					f.Idx = schema.MustIdxBetween(d.rng, "", "")
					err = nil
				}
			}
			indices[f.Idx] = f
		}
	} else {
		d.forphans[fid] = f
	}

	return nil
}

// lset applies incoming to the Doc.
// # Concurrency
//
// Caller must hold the write lock.
func (d *Doc) lset(incoming *schema.Layer) (err error) {
	lid := incoming.Id
	l, ok := d.lnodes[lid]
	if !ok {
		l = &schema.StoredLayer{}
		d.lnodes[lid] = l
	}

	prev := *l
	defer func() {
		if err != nil {
			d.lnodes[lid] = &prev
		}
	}()

	l.Merge(d.g, incoming)

	// We don't update changes to lindices in the defer above so everything below this line needs to be infallible.
	if prev.IdxState == schema.Set {
		delete(d.lindices, prev.Idx)
	}
	if l.IdxState == schema.Set {
		if _, ok := d.lindices[l.Idx]; ok {
			l.Idx, err = idxCollisionFix(d.rng, d.lindices, l.Idx)
			if err != nil {
				d.l.DPanic("invalid idx in Doc", zap.Error(err))
				l.Idx = schema.MustIdxBetween(d.rng, "", "")
				err = nil
			}
		}
		d.lindices[l.Idx] = l
	}

	return nil
}

// childrenOf returns a map of fid to feature for all children of the given feature.
func (d *Doc) childrenOf(fid string) map[string]*schema.StoredFeature {
	return d.ftree[fid]
}

// idxBeforeFirstChildOf returns an idx that sorts before the first child of the given feature.
func (d *Doc) idxBeforeFirstChildOf(fid string) string {
	peers := d.childrenOf(fid)
	first := ""
	for _, peer := range peers {
		if first == "" || peer.Idx < first {
			first = peer.Idx
		}
	}

	idx, err := schema.IdxBetween(d.rng, "", first)
	if err != nil {
		d.l.DPanic("invalid idx in Doc", zap.Error(err))
		return schema.MustIdxBetween(d.rng, "", "")
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

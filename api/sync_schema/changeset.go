package sync_schema

import (
	"encoding/json"
	"slices"
)

type Changeset struct {
	FDelete map[string]struct{}
	// Newly added children must come after their newly added parents. This can
	// be satisfied by simply recording adds in the order they happened.
	//
	// Because order matters we can't use a map here, so we deduplicate on
	// marshalling instead. But duplicate adds should be rare.
	FAdd []string
	FSet map[string]*Feature
	LSet map[string]*Layer
}

func (c *Changeset) Merge(incoming *Changeset) {
	if incoming == nil {
		return
	}
	for id := range incoming.FDelete {
		if c.FDelete == nil {
			c.FDelete = make(map[string]struct{})
		}
		c.FDelete[id] = struct{}{}
	}
	c.FAdd = append(c.FAdd, incoming.FAdd...)
	for k, v := range incoming.FSet {
		if c.FSet == nil {
			c.FSet = make(map[string]*Feature)
		}
		if existing, ok := c.FSet[k]; ok {
			existing.Merge(v)
			c.FSet[k] = existing
		} else {
			c.FSet[k] = v
		}
	}
	for k, v := range incoming.LSet {
		if c.LSet == nil {
			c.LSet = make(map[string]*Layer)
		}
		if existing, ok := c.LSet[k]; ok {
			existing.Merge(v)
			c.LSet[k] = existing
		} else {
			c.LSet[k] = v
		}
	}
}

type dto struct {
	FDelete []string            `json:"fdelete,omitempty"`
	FAdd    []string            `json:"fadd,omitempty"`
	FSet    map[string]*Feature `json:"fset,omitempty"`
	LSet    map[string]*Layer   `json:"lset,omitempty"`
}

func (c Changeset) MarshalJSON() ([]byte, error) {
	return c.marshalJSON(false)
}

func (c Changeset) MarshalJSONStable() ([]byte, error) {
	return c.marshalJSON(true)
}

func (c Changeset) marshalJSON(stable bool) ([]byte, error) {
	var adds []string
	if c.FAdd != nil {
		adds = make([]string, 0, len(c.FAdd))
		addsSeen := make(map[string]struct{})
		for _, id := range c.FAdd {
			if _, ok := addsSeen[id]; ok {
				continue
			}
			addsSeen[id] = struct{}{}
			adds = append(adds, id)
		}
	}

	var deletes []string
	if c.FDelete != nil {
		deletes = keys(c.FDelete)
		if stable {
			slices.Sort(deletes)
		}
	}

	return json.Marshal(dto{
		FDelete: deletes,
		FAdd:    adds,
		FSet:    c.FSet,
		LSet:    c.LSet,
	})
}

func (c *Changeset) UnmarshalJSON(data []byte) error {
	var dto dto
	if err := json.Unmarshal(data, &dto); err != nil {
		return err
	}
	if dto.FDelete != nil {
		c.FDelete = make(map[string]struct{})
		for _, id := range dto.FDelete {
			c.FDelete[id] = struct{}{}
		}
	}
	c.FAdd = dto.FAdd
	if dto.FSet != nil {
		c.FSet = make(map[string]*Feature)
		for fid, f := range dto.FSet {
			f.Id = fid
			c.FSet[fid] = f
		}
	}
	if dto.LSet != nil {
		c.LSet = make(map[string]*Layer)
		for lid, l := range dto.LSet {
			l.Id = lid
			c.LSet[lid] = l
		}
	}
	return nil
}

func keys(m map[string]struct{}) []string {
	keys := make([]string, 0, len(m))
	for k := range m {
		keys = append(keys, k)
	}
	return keys
}

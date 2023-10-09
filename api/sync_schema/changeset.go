package sync_schema

import "encoding/json"

type Changeset struct {
	FDelete map[string]struct{}
	// Newly added children must come after their newly added parents. This can
	// be satisfied by simply recording adds in the order they happened.
	//
	// Because order matters we can't use a map here. Instead we deduplicate on
	// marshalling. But duplicate adds should be rare.
	FAdd []string
	FSet map[string]Feature
	LSet map[string]Layer
}

func (c *Changeset) IsNil() bool {
	return c == nil || (c.FDelete == nil && c.FAdd == nil && c.FSet == nil && c.LSet == nil)
}

/*
ShallowClone copies the changeset down to the values of individual features
and layers
*/
func (c *Changeset) ShallowClone() *Changeset {
	if c == nil {
		return nil
	}
	out := &Changeset{}
	if c.FDelete != nil {
		out.FDelete = make(map[string]struct{}, len(c.FDelete))
		for k := range c.FDelete {
			out.FDelete[k] = struct{}{}
		}
	}
	if c.FAdd != nil {
		out.FAdd = make([]string, len(c.FAdd))
		copy(out.FAdd, c.FAdd)
	}
	if c.FSet != nil {
		out.FSet = make(map[string]Feature, len(c.FSet))
		for k, v := range c.FSet {
			out.FSet[k] = v.ShallowClone()
		}
	}
	if c.LSet != nil {
		out.LSet = make(map[string]Layer, len(c.LSet))
		for k, v := range c.LSet {
			out.LSet[k] = v.ShallowClone()
		}
	}
	return out
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
			c.FSet = make(map[string]Feature)
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
			c.LSet = make(map[string]Layer)
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
	FDelete []string           `json:"fdelete,omitempty"`
	FAdd    []string           `json:"fadd,omitempty"`
	FSet    map[string]Feature `json:"fset,omitempty"`
	LSet    map[string]Layer   `json:"lset,omitempty"`
}

func (c Changeset) MarshalJSON() ([]byte, error) {
	adds := make([]string, 0, len(c.FAdd))
	addsSeen := make(map[string]struct{})
	for _, id := range c.FAdd {
		if _, ok := addsSeen[id]; ok {
			continue
		}
		addsSeen[id] = struct{}{}
		adds = append(adds, id)
	}
	return json.Marshal(dto{
		FDelete: keys(c.FDelete),
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
	c.FSet = dto.FSet
	c.LSet = dto.LSet
	return nil
}

func keys(m map[string]struct{}) []string {
	keys := make([]string, 0, len(m))
	for k := range m {
		keys = append(keys, k)
	}
	return keys
}

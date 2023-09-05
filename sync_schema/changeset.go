package sync_schema

import "encoding/json"

type Changeset struct {
	FDelete map[string]struct{}
	// Newly added children must come after their newly added parents. This can
	// be satisfied by simply recording adds in the order they happened.
	FAdd map[string]struct{}
	FSet map[string]Feature
	LSet map[string]Layer
}

func (c *Changeset) Merge(incoming *Changeset) {
	if incoming == nil {
		return
	}
	for id := range incoming.FDelete {
		c.FDelete[id] = struct{}{}
	}
	for id := range incoming.FAdd {
		c.FAdd[id] = struct{}{}
	}
	for k, v := range incoming.FSet {
		if existing, ok := c.FSet[k]; ok {
			existing.Merge(v)
			c.FSet[k] = existing
		} else {
			c.FSet[k] = v
		}
	}
	for k, v := range incoming.LSet {
		if existing, ok := c.LSet[k]; ok {
			existing.Merge(v)
			c.LSet[k] = existing
		} else {
			c.LSet[k] = v
		}
	}
}

type dto struct {
	FDelete []string           `json:"fdelete"`
	FAdd    []string           `json:"fadd"`
	FSet    map[string]Feature `json:"fset"`
	LSet    map[string]Layer   `json:"lset"`
}

func (c Changeset) MarshalJSON() ([]byte, error) {
	return json.Marshal(dto{
		FDelete: keys(c.FDelete),
		FAdd:    keys(c.FAdd),
		FSet:    c.FSet,
		LSet:    c.LSet,
	})
}

func (c *Changeset) UnmarshalJSON(data []byte) error {
	var dto dto
	if err := json.Unmarshal(data, &dto); err != nil {
		return err
	}
	c.FDelete = make(map[string]struct{})
	for _, id := range dto.FDelete {
		c.FDelete[id] = struct{}{}
	}
	c.FAdd = make(map[string]struct{})
	for _, id := range dto.FAdd {
		c.FAdd[id] = struct{}{}
	}
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

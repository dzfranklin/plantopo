package sync_schema

import (
	"encoding/json"
	"errors"
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

type streamDto struct {
	FDelete []string                   `json:"fdelete,omitempty"`
	FAdd    []string                   `json:"fadd,omitempty"`
	FSet    map[string]json.RawMessage `json:"fset,omitempty"`
	LSet    json.RawMessage            `json:"lset,omitempty"`
}

const maxContainerOverhead = len(`{"fadd":[],"fdelete":[],"fset":{},"lset":{}}`)

func (c Changeset) MarshalJSONStream(maxChunk int, cb func([]byte) error) (err error) {
	// prepare

	faddsSeen := make(map[string]struct{}, len(c.FAdd))
	fadds := make([]string, 0, len(c.FAdd))
	for _, id := range c.FAdd {
		if _, ok := faddsSeen[id]; ok {
			continue
		}
		faddsSeen[id] = struct{}{}
		fadds = append(fadds, id)
	}

	fupdates := make([]string, 0, len(c.FSet))
	for id := range c.FSet {
		if _, ok := faddsSeen[id]; ok {
			continue
		}
		fupdates = append(fupdates, id)
	}
	slices.Sort(fupdates)

	fchanges := append(fadds, fupdates...)

	var deletes []string
	if c.FDelete != nil {
		deletes = keys(c.FDelete)
		slices.Sort(deletes)
	}

	// serialize chunks

	var chunkDto streamDto
	chunkSize := maxContainerOverhead

	// Always send all layers initially, they should be a reasonable size
	if c.LSet != nil {
		if chunkDto.LSet, err = json.Marshal(c.LSet); err != nil {
			return
		}
		chunkSize += len(chunkDto.LSet)
	}

	fchangeI := 0
	fdeleteI := 0
	for {
		for {
			if fchangeI < len(fchanges) {
				fid := fchanges[fchangeI]
				_, isAdd := faddsSeen[fid]

				fset, ok := c.FSet[fid]
				if !ok {
					return errors.New("missing fset for fadd")
				}
				var fsetBytes []byte
				if fsetBytes, err = json.Marshal(fset); err != nil {
					return
				}

				size := len(fid) + 2 + 1 + len(fsetBytes) + 1 // fset: fid + quotes + colon + fsetBytes + comma
				if isAdd {
					size += len(fid) + 2 + 1 // fadd: fid + quotes + comma
				}
				if maxChunk > 0 && chunkSize+size > maxChunk {
					break
				}

				if isAdd {
					chunkDto.FAdd = append(chunkDto.FAdd, fid)
				}

				if chunkDto.FSet == nil {
					chunkDto.FSet = make(map[string]json.RawMessage)
				}
				chunkDto.FSet[fid] = fsetBytes

				chunkSize += size
				fchangeI += 1
				continue
			}

			if fdeleteI < len(deletes) {
				fid := deletes[fdeleteI]

				size := len(fid) + 2 + 1 // fdelete: fid + quotes + comma
				if maxChunk > 0 && chunkSize+size > maxChunk {
					break
				}
				fdeleteI += 1
				chunkDto.FDelete = append(chunkDto.FDelete, fid)
				chunkSize += size
			}

			break
		}

		if chunkSize <= maxContainerOverhead {
			if fchangeI < len(fadds) || fdeleteI < len(deletes) {
				return errors.New("chunk too large")
			}
			break
		}

		var chunk []byte
		if chunk, err = json.Marshal(chunkDto); err != nil {
			return
		}
		if err = cb(chunk); err != nil {
			return
		}
		chunkDto = streamDto{}
		chunkSize = maxContainerOverhead
	}

	return nil
}

func (c Changeset) MarshalJSON() ([]byte, error) {
	var out []byte
	err := c.MarshalJSONStream(-1, func(bytes []byte) error {
		out = bytes
		return nil
	})
	return out, err
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

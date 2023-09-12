package sync_schema

import (
	"encoding/json"
	"fmt"
)

// One or zero of the fields will be non-nil.
type Geometry struct {
	Point      *PointGeometry
	LineString *LineStringGeometry
}

type PointGeometry struct {
	Coordinates [2]float64
}

type LineStringGeometry struct {
	Coordinates [][2]float64
}

func (t Geometry) MarshalJSON() ([]byte, error) {
	type raw struct {
		Type        string      `json:"type"`
		Coordinates interface{} `json:"coordinates"`
	}
	if t.Point != nil {
		return json.Marshal(raw{
			Type:        "Point",
			Coordinates: t.Point.Coordinates,
		})
	} else if t.LineString != nil {
		return json.Marshal(raw{
			Type:        "LineString",
			Coordinates: t.LineString.Coordinates,
		})
	} else {
		return []byte("null"), nil
	}
}

func (t *Geometry) UnmarshalJSON(data []byte) error {
	type raw struct {
		Type        string          `json:"type"`
		Coordinates json.RawMessage `json:"coordinates"`
	}
	var r raw
	if err := json.Unmarshal(data, &r); err != nil {
		return err
	}
	switch r.Type {
	case "":
		return nil
	case "Point":
		t.Point = &PointGeometry{}
		if err := json.Unmarshal(r.Coordinates, &t.Point.Coordinates); err != nil {
			return err
		}
	case "LineString":
		t.LineString = &LineStringGeometry{}
		if err := json.Unmarshal(r.Coordinates, &t.LineString.Coordinates); err != nil {
			return err
		}
	default:
		return fmt.Errorf("invalid geometry type %q", r.Type)
	}
	return nil
}

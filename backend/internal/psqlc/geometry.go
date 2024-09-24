package psqlc

import (
	"database/sql/driver"
	"encoding/hex"
	"errors"
	"fmt"
	"github.com/dzfranklin/plantopo/backend/internal/pslices"
	"github.com/paulmach/orb"
	"github.com/paulmach/orb/encoding/ewkb"
	"github.com/tidwall/geojson/geometry"
)

const srid = 4326

type Geometry struct {
	geometry.Geometry
}

func (c Geometry) Value() (driver.Value, error) {
	switch g := c.Geometry.(type) {
	case *geometry.Line:
		v := make(orb.LineString, 0, g.NumPoints())
		for i := range g.NumPoints() {
			p := g.PointAt(i)
			v = append(v, orb.Point{p.X, p.Y})
		}
		return ewkb.MarshalToHex(v, srid)
	default:
		panic("unimplemented")
	}
}

func (c *Geometry) Scan(value interface{}) error {
	h, isB := value.(string)
	if !isB {
		return errors.New("scan Geometry: expected []byte")
	}

	b, err := hex.DecodeString(h)
	if err != nil {
		return err
	}

	geom, scannedSRID, err := ewkb.Unmarshal(b)
	if err != nil {
		return fmt.Errorf("scan Geometry: %w", err)
	}
	if scannedSRID != srid {
		return errors.New("scan Geometry: unexpected srid")
	}

	switch g := geom.(type) {
	case orb.LineString:
		c.Geometry = geometry.NewLine(pslices.Map(g, orbPointToG), nil)
		return nil
	default:
		panic("unimplemented")
	}
}

func orbPointToG(p orb.Point) geometry.Point {
	return geometry.Point{X: p[0], Y: p[1]}
}

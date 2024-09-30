package psqlc

import (
	"fmt"
	"github.com/dzfranklin/plantopo/backend/internal/pgeo"
	"github.com/dzfranklin/plantopo/backend/internal/pslices"
	"github.com/tidwall/geojson/geometry"
	"github.com/twpayne/go-geom"
)

const srid = 4326

type Point geometry.Point

func (p *Point) ScanGeom(v geom.T) error {
	gp, isPoint := v.(*geom.Point)
	if !isPoint {
		return fmt.Errorf("expected to scan into *geom.Point, got %T", v)
	}
	p.X = gp.X()
	p.Y = gp.Y()
	return nil
}

func (p Point) GeomValue() (geom.T, error) {
	return geom.NewPoint(geom.XY).MustSetCoords(geom.Coord{p.X, p.Y}).SetSRID(srid), nil
}

type Line geometry.Line

func (l *Line) ScanGeom(v geom.T) error {
	gl, isLine := v.(*geom.LineString)
	if !isLine {
		return fmt.Errorf("expected to scan into *geom.LineString, got %T", v)
	}

	coords := pslices.Map(gl.Coords(), func(t geom.Coord) geometry.Point {
		return geometry.Point{X: t.X(), Y: t.Y()}
	})

	*l = Line(*geometry.NewLine(coords, nil))
	return nil
}

func (l *Line) GeomValue() (geom.T, error) {
	coords := pslices.Map(pgeo.LinePoints((*geometry.Line)(l)), func(p geometry.Point) geom.Coord {
		return geom.Coord{p.X, p.Y}
	})
	return geom.NewLineString(geom.XY).MustSetCoords(coords).SetSRID(srid), nil
}

package psearch

import (
	"github.com/tidwall/geojson"
	"github.com/tidwall/geojson/geometry"
)

const (
	PostcodeType       = "postcode"
	HillType           = "hill"
	StreetType         = "street"
	PopulatedPlaceType = "populated_place"
	WaterBodyType      = "water_body"
	OtherType          = "other"
)

type Query struct {
	User          string // optional
	Text          string
	HigherQuality bool
	Bias          *Bias
}

type Result struct {
	ID           string
	Name         string
	Type         string
	CountryCode2 string
	Geometry     geojson.Object
	Debug        map[string]any
	matchingTerm string
	weight       float64
}

type Bias struct {
	Center geometry.Point
	Zoom   int
}

func (q Query) BiasCenter() *geometry.Point {
	if q.Bias != nil {
		return &q.Bias.Center
	}
	return nil
}

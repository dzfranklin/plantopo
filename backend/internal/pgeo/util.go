package pgeo

import (
	"github.com/tidwall/geojson/geometry"
	"math"
)

func LinePoints(line *geometry.Line) []geometry.Point {
	points := make([]geometry.Point, line.NumPoints())
	for i := range points {
		points[i] = line.PointAt(i)
	}
	return points
}

func RoundPoint(point geometry.Point) geometry.Point {
	return geometry.Point{X: roundPointComponent(point.X), Y: roundPointComponent(point.Y)}
}

func roundPointComponent(n float64) float64 {
	scale := math.Pow10(6)
	return math.Round(n*scale) / scale
}

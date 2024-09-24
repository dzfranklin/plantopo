package pgeo

import "github.com/tidwall/geojson/geometry"

func LinePoints(line *geometry.Line) []geometry.Point {
	points := make([]geometry.Point, line.NumPoints())
	for i := range points {
		points[i] = line.PointAt(i)
	}
	return points
}

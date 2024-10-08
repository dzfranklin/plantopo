package pgeo

import (
	"fmt"
	"github.com/tidwall/geojson/geometry"
	"github.com/twpayne/go-polyline"
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

func EncodePolylinePoints(points []geometry.Point) string {
	input := make([][]float64, len(points))
	for i := range points {
		input[i] = []float64{points[i].Y, points[i].X} // polyline is lat,lng
	}
	return string(polyline.EncodeCoords(input))
}

func DecodePolylinePoints(s string) ([]geometry.Point, error) {
	pl, remaining, err := polyline.DecodeCoords([]byte(s))
	if err != nil {
		return nil, err
	}
	if len(remaining) > 0 {
		return nil, fmt.Errorf("invalid polyline")
	}

	points := make([]geometry.Point, len(pl))
	for i := range pl {
		points[i] = geometry.Point{Y: pl[i][0], X: pl[i][1]}
	}
	return points, nil
}

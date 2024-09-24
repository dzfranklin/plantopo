package pgeo

import "github.com/tidwall/geojson/geometry"

/* Ported from Simplify.js v1.2.4, a high-performance JavaScript polyline simplification
 library by Vladimir Agafonkin, extracted from Leaflet. <https://github.com/mourner/simplify-js>

Copyright (c) 2017, Vladimir Agafonkin
All rights reserved.

Redistribution and use in source and binary forms, with or without modification, are
permitted provided that the following conditions are met:

   1. Redistributions of source code must retain the above copyright notice, this list of
      conditions and the following disclaimer.

   2. Redistributions in binary form must reproduce the above copyright notice, this list
      of conditions and the following disclaimer in the documentation and/or other materials
      provided with the distribution.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND ANY
EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF
MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE
COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL,
EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF
SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION)
HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR
TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
*/

func getSqDist(p1, p2 geometry.Point) float64 {
	dx := p1.X - p2.X
	dy := p1.Y - p2.Y
	return dx*dx + dy*dy
}

func getSqSegDist(p, p1, p2 geometry.Point) float64 {
	x := p1.X
	y := p1.Y
	dx := p2.X - x
	dy := p2.Y - y

	if dx != 0 || dy != 0 {
		t := ((p.X-x)*dx + (p.Y-y)*dy) / (dx*dx + dy*dy)

		if t > 1 {
			x = p2.X
			y = p2.Y
		} else if t > 0 {
			x += dx * t
			y += dy * t
		}
	}

	dx = p.X - x
	dy = p.Y - y

	return dx*dx + dy*dy
}

func simplifyRadialDist(points []geometry.Point, sqTolerance float64) []geometry.Point {
	prevPoint := points[0]
	newPoints := []geometry.Point{prevPoint}
	var point geometry.Point

	for i := 1; i < len(points); i++ {
		point = points[i]

		if getSqDist(point, prevPoint) > sqTolerance {
			newPoints = append(newPoints, point)
			prevPoint = point
		}
	}

	if prevPoint != point {
		newPoints = append(newPoints, point)
	}

	return newPoints
}

func simplifyDPStep(
	points []geometry.Point,
	first, last int,
	sqTolerance float64,
	simplified []geometry.Point,
) []geometry.Point {
	maxSqDist := sqTolerance
	var index int

	for i := first + 1; i < last; i++ {
		sqDist := getSqSegDist(points[i], points[first], points[last])

		if sqDist > maxSqDist {
			index = i
			maxSqDist = sqDist
		}
	}

	if maxSqDist > sqTolerance {
		if index-first > 1 {
			simplified = simplifyDPStep(points, first, index, sqTolerance, simplified)
		}
		simplified = append(simplified, points[index])
		if last-index > 1 {
			simplified = simplifyDPStep(points, index, last, sqTolerance, simplified)
		}
	}

	return simplified
}

func simplifyDouglasPeucker(points []geometry.Point, sqTolerance float64) []geometry.Point {
	last := len(points) - 1

	simplified := []geometry.Point{points[0]}
	simplified = simplifyDPStep(points, 0, last, sqTolerance, simplified)
	simplified = append(simplified, points[last])

	return simplified
}

func simplify(points []geometry.Point, tolerance float64, highestQuality bool) []geometry.Point {
	if len(points) <= 2 {
		return points
	}

	sqTolerance := 1.0
	if tolerance > 0 {
		sqTolerance = tolerance * tolerance
	}

	if !highestQuality {
		points = simplifyRadialDist(points, sqTolerance)
	}
	points = simplifyDouglasPeucker(points, sqTolerance)

	return points
}

func Simplify(line *geometry.Line, tolerance float64, best bool) *geometry.Line {
	simplified := simplify(LinePoints(line), tolerance, best)
	return geometry.NewLine(simplified, nil)
}

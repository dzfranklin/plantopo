package main

import (
	"embed"
	"github.com/dzfranklin/plantopo/backend/internal/pslices"
	"github.com/stretchr/testify/assert"
	"github.com/tidwall/geojson/geometry"
	"io"
	"slices"
	"testing"
)

//go:embed test_samples/*
var samples embed.FS

func TestProcessIntersectionSample(t *testing.T) {
	got := process(openSample("trail_intersection_sample.osm.pbf"))
	// Verify via pasting output of run with -segment-geojson flag into geojson.io

	assert.Equal(t, len(got.Segments), 5)

	junctionWays := []int64{993143301, 144519024}
	var gotJunctionSegments []int
	for i, s := range got.Segments {
		if slices.Contains(junctionWays, s.Way) {
			gotJunctionSegments = append(gotJunctionSegments, i)
		}
	}

	assert.Len(t, gotJunctionSegments, 3) // since 144519024 is split at the junction

	// Check each junction segment is linked to the other two
	for _, s := range gotJunctionSegments {
		var otherSegments []int
		for _, otherS := range gotJunctionSegments {
			if otherS != s {
				otherSegments = append(otherSegments, otherS)
			}
		}
		assert.Len(t, otherSegments, 2)

		gotLinks := got.Links[s]
		assert.Contains(t, gotLinks, otherSegments[0])
		assert.Contains(t, gotLinks, otherSegments[1])
	}
}

func TestSplitSegments(t *testing.T) {
	cases := []struct {
		name  string
		input []Segment
		want  []Segment
	}{
		{
			name: "nothing to split",
			input: []Segment{
				{Way: 1, Points: []NodePoint{{Node: 1}, {Node: 2}}},
				{Way: 2, Points: []NodePoint{{Node: 3}, {Node: 4}}},
			},
			want: []Segment{
				{Way: 1, Points: []NodePoint{{Node: 1}, {Node: 2}}},
				{Way: 2, Points: []NodePoint{{Node: 3}, {Node: 4}}},
			},
		},
		{
			name: "cross",
			input: []Segment{
				{Way: 1, Points: []NodePoint{{Node: 1}, {Node: 2}, {Node: 3}}},
				{Way: 2, Points: []NodePoint{{Node: 3}, {Node: 2}, {Node: 5}}},
			},
			want: []Segment{
				{Way: 1, Points: []NodePoint{{Node: 1}, {Node: 2}}},
				{Way: 1, Points: []NodePoint{{Node: 2}, {Node: 3}}},
				{Way: 2, Points: []NodePoint{{Node: 3}, {Node: 2}}},
				{Way: 2, Points: []NodePoint{{Node: 2}, {Node: 5}}},
			},
		},
		{
			name:  "empty segment",
			input: []Segment{{Way: 1, Points: []NodePoint{{Node: 1}}}},
			want:  []Segment{},
		},
		{
			name: "empty loop",
			input: []Segment{
				{Way: 1, Points: []NodePoint{{Node: 1}, {Node: 1}}},
			},
			want: []Segment{},
		},
		{
			name: "loop len 3",
			input: []Segment{
				{Way: 1, Points: []NodePoint{{Node: 1}, {Node: 2}, {Node: 1}}},
			},
			want: []Segment{
				{Way: 1, Points: []NodePoint{{Node: 1}, {Node: 2}}},
				{Way: 1, Points: []NodePoint{{Node: 2}, {Node: 1}}},
			},
		},
		{
			name: "loop",
			input: []Segment{
				{Way: 1, Points: []NodePoint{{Node: 1}, {Node: 2}, {Node: 3}, {Node: 1}}},
			},
			want: []Segment{
				{Way: 1, Points: []NodePoint{{Node: 1}, {Node: 2}, {Node: 3}}},
				{Way: 1, Points: []NodePoint{{Node: 3}, {Node: 1}}},
			},
		},
	}

	for _, tt := range cases {
		t.Run(tt.name, func(t *testing.T) {
			got := splitSegments(tt.input)
			assert.ElementsMatch(t, tt.want, got, "splitSegments(%+v)", tt.input)
		})
	}
}

func TestScanStage1(t *testing.T) {
	_, got := scanStage1(openSample("trail_intersection_sample.osm.pbf"))
	assert.Contains(t, got, int64(981376586), "has footbridge node")
	assert.NotContains(t, got, int64(623611000), "doesn't have river node")
}

func TestScanStages(t *testing.T) {
	_, nodesOfInterest := scanStage1(openSample("trail_intersection_sample.osm.pbf"))
	got := scanStage2(openSample("trail_intersection_sample.osm.pbf"), nodesOfInterest)

	gotWays := pslices.Map(got, func(s Segment) int64 { return s.Way })
	// Verify via <https://overpass-turbo.eu/?Q=%5Bbbox%3A56.8187786142%2C-3.8240529289%2C56.8200899026%2C-3.8212243862%5D%3B%0A%28%0A++way%5Bhighway%5D%3B%0A%29%3B%0Aout+skel%3B%0A&C=56.819106%3B-3.822035%3B18>
	assert.ElementsMatch(t, gotWays, []int64{84455457, 144519024, 864123467, 993143301})

	for _, gotSeg := range got {
		for _, gotPt := range gotSeg.Points {
			assert.NotZero(t, gotPt.Point.X)
			assert.NotZero(t, gotPt.Point.Y)
		}
	}
}

func TestSegmentMeters(t *testing.T) {
	input := Segment{
		Points: []NodePoint{
			{Node: 1, Point: geometry.Point{X: 0.1, Y: 0.2}},
			{Node: 2, Point: geometry.Point{X: 0.3, Y: 0.4}},
			{Node: 3, Point: geometry.Point{X: 0.5, Y: 0.6}},
		},
	}
	got := segmentMeters(input)
	// Verify via <https://www.movable-type.co.uk/scripts/latlong.html>
	assert.InDelta(t, 31450+31450, got, 5)
}

func openSample(name string) io.ReadSeeker {
	f, err := samples.Open("test_samples/" + name)
	if err != nil {
		panic(err)
	}
	return f.(io.ReadSeeker)
}

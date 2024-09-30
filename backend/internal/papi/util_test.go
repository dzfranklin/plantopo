package papi

import (
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/tidwall/geojson"
	"github.com/tidwall/geojson/geometry"
	"testing"
)

func TestMapGeometry(t *testing.T) {
	cases := []struct {
		name     string
		input    geojson.Object
		expected string
	}{
		{
			name:     "point",
			input:    geojson.NewPoint(geometry.Point{X: 1, Y: 2}),
			expected: `{"type":"Point","coordinates":[1,2]}`,
		},
		{
			name: "multilinestring",
			input: geojson.NewMultiLineString([]*geometry.Line{
				geometry.NewLine([]geometry.Point{{X: 1, Y: 2}, {X: 3, Y: 4}}, nil),
				geometry.NewLine([]geometry.Point{{X: 4, Y: 5}, {X: 6, Y: 7}}, nil),
			}),
			expected: `{"type":"MultiLineString","coordinates":[[[1,2],[3,4]],[[4,5],[6,7]]]}`,
		},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			got, marshalErr := mapGeometry(c.input).MarshalJSON()
			require.NoError(t, marshalErr)
			assert.Equal(t, c.expected, string(got))
		})
	}
}

package pstaticmap

import (
	"github.com/stretchr/testify/assert"
	"github.com/tidwall/geojson/geometry"
	"testing"
)

func Test_viewport_fitTo(t *testing.T) {
	type want struct {
		lng  float64
		lat  float64
		zoom int
	}
	tests := []struct {
		name string
		v    viewport
		arg  []DrawOp
		want want
	}{
		{
			name: "point",
			v:    viewport{width: 200, height: 200},
			arg: []DrawOp{
				Circle{
					Center: geometry.Point{X: 100, Y: 50},
					Radius: 2,
				},
			},
			want: want{lng: 100, lat: 50, zoom: 16},
		},
		{
			name: "line",
			v:    viewport{width: 200, height: 200},
			arg: []DrawOp{
				Line{
					Points: []geometry.Point{{X: 100, Y: 50}, {X: 100.1, Y: 50.1}},
					Width:  2,
				},
			},
			want: want{lng: 105, lat: 55, zoom: 10},
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			v := &tt.v
			v.fitTo(v, tt.arg)
			assert.InDelta(t, tt.want.lng, v.centerLng, 5)
			assert.InDelta(t, tt.want.lat, v.centerLat, 5)
			assert.Equal(t, tt.want.zoom, v.zoom)
		})
	}
}

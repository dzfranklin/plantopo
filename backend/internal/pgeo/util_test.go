package pgeo

import (
	"github.com/stretchr/testify/assert"
	"github.com/tidwall/geojson/geometry"
	"testing"
)

func TestRoundPoint(t *testing.T) {
	got := RoundPoint(geometry.Point{X: -2.0000006, Y: 1.0000004})
	assert.Equal(t, geometry.Point{X: -2.000001, Y: 1}, got)
}

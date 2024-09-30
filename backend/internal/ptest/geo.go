package ptest

import (
	"github.com/stretchr/testify/assert"
	"github.com/tidwall/geojson/geometry"
	"testing"
)

func AssertPointsEqual(t *testing.T, expected geometry.Point, got geometry.Point) {
	t.Helper()
	assert.InDelta(t, expected.X, got.X, 0.0009)
	assert.InDelta(t, expected.Y, got.Y, 0.0009)
}

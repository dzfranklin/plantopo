package pgeo

import (
	"github.com/stretchr/testify/assert"
	"github.com/tidwall/geojson/geometry"
	"testing"
)

func TestFeatureCollectionWriterEmpty(t *testing.T) {
	var fc FeatureCollectionWriter
	got := fc.Finish()
	assert.JSONEq(t, `{"type": "FeatureCollection", "features": []}`, string(got))
}

func TestFeatureCollectionWriterPoint(t *testing.T) {
	var fc FeatureCollectionWriter
	fc.WritePoint(0, geometry.Point{1, 2}, map[string]any{"foo": "bar"})
	got := fc.Finish()
	assert.JSONEq(t, `{"type": "FeatureCollection", "features": [{"type": "Feature", "properties": {"foo": "bar"}, "geometry": {"type": "Point", "coordinates": [1,2]}}]}`, string(got))
}

func BenchmarkFeatureCollectionWriter(b *testing.B) {
	var fc FeatureCollectionWriter
	for i := 0; i < b.N; i++ {
		fc.WritePoint(1, geometry.Point{1, 2}, map[string]any{"k1": "v1", "k2": "v2", "k3": "v3", "k4": "v4", "k5": 5, "k6": 6, "k7": 7, "k8": 8, "k9": 9})
	}
	fc.Finish()
}

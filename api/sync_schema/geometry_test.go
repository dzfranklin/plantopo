package sync_schema

import (
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestMarshalEmptyGeometry(t *testing.T) {
	type container struct{ Geom Geometry }
	got, err := json.Marshal(container{})
	require.NoError(t, err)
	require.Equal(t, `{"Geom":null}`, string(got))
}

func TestMarshalPointGeometry(t *testing.T) {
	type container struct{ Geom Geometry }
	got, err := json.Marshal(container{Geom: Geometry{
		Point: &PointGeometry{Coordinates: [2]float64{1, 2}},
	}})
	require.NoError(t, err)
	require.Equal(t, `{"Geom":{"type":"Point","coordinates":[1,2]}}`, string(got))
}

func TestUnmarshalEmptyGeometry(t *testing.T) {
	type container struct{ Geom Geometry }

	var c1 container
	err := json.Unmarshal([]byte(`{"Geom":null}`), &c1)
	require.NoError(t, err)
	require.Equal(t, container{}, c1)

	var c2 container
	err = json.Unmarshal([]byte(`{}`), &c2)
	require.NoError(t, err)
	require.Equal(t, container{}, c2)
}

func TestUnmarshalPointGeometry(t *testing.T) {
	type container struct{ Geom Geometry }

	var c container
	err := json.Unmarshal([]byte(`{"Geom":{"type":"Point","coordinates":[1,2]}}`), &c)
	require.NoError(t, err)
	require.Equal(t, container{Geom: Geometry{
		Point: &PointGeometry{Coordinates: [2]float64{1, 2}},
	}}, c)
}

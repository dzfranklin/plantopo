package pstaticmap

import (
	"encoding/xml"
	"fmt"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/tidwall/geojson/geometry"
	"strings"
	"testing"
)

func Test_drawSvg(t *testing.T) {
	view := viewport{
		// Canterbury
		centerLng: 1.080445,
		centerLat: 51.280174,
		width:     500,
		height:    250,
		zoom:      7,
	}

	validCircle := Circle{
		Center:    geometry.Point{X: 1.080445, Y: 51.280174},
		Radius:    4,
		Color:     "purple",
		HaloColor: "white",
		HaloWidth: 1,
	}

	validLine := Line{
		Points:    []geometry.Point{{X: 1.080445, Y: 51.280174}, {X: 1.1, Y: 51.3}, {X: 1.2, Y: 51.4}},
		Color:     "blue",
		Width:     4,
		HaloColor: "white",
		HaloWidth: 2,
	}

	t.Run("empty", func(t *testing.T) {
		gotBytes, err := drawSvg(view, nil)
		require.NoError(t, err)
		assertValidXML(t, gotBytes)
		got := string(gotBytes)

		assert.Contains(t, got, `width="500"`)
		assert.Contains(t, got, `height="250"`)
		assert.Contains(t, got, "© OpenStreetMap")
		fmt.Println(got)
	})

	t.Run("outputs in order", func(t *testing.T) {
		gotBytes, err := drawSvg(view, []DrawOp{validCircle, validLine})
		require.NoError(t, err)
		assertValidXML(t, gotBytes)
		got := string(gotBytes)

		require.Contains(t, got, "<circle")
		require.Contains(t, got, "<path")

		circleIndex := strings.Index(got, "<circle")
		pathIndex := strings.Index(got, "<path")
		require.Greater(t, pathIndex, circleIndex)

		fmt.Println(got)
	})
}

func assertValidXML(t *testing.T, got []byte) {
	var out any
	err := xml.Unmarshal(got, &out)
	assert.NoError(t, err)
}

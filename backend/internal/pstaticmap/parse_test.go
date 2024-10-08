package pstaticmap

import (
	"fmt"
	"github.com/stretchr/testify/require"
	"github.com/tidwall/geojson/geometry"
	"testing"
)

func TestParseSerializeOptsRoundTrip(t *testing.T) {
	center := geometry.Point{X: 2, Y: 3}
	z := 8
	fullCircle := Circle{
		Center:    center,
		Color:     "red",
		Radius:    3,
		HaloColor: "white",
		HaloWidth: 2,
	}
	fullLine := Line{
		Points:    []geometry.Point{{X: 1.1, Y: 1.1}, {X: 1.2, Y: 1.2}},
		Color:     "blue",
		Width:     3,
		HaloColor: "white",
		HaloWidth: 2,
	}
	full := Opts{
		Width:   1,
		Height:  2,
		Center:  &center,
		Zoom:    &z,
		Fit:     true,
		Padding: 11,
		Draw: []DrawOp{
			fullCircle,
			fullLine,
			fullCircle,
			fullLine,
		},
	}

	serialized := SerializeOpts(full)
	fmt.Println(serialized)

	parsed, parseErr := ParseOpts(serialized)
	require.NoError(t, parseErr)

	fullDraw := full.Draw
	parsedDraw := parsed.Draw
	full.Draw = nil
	parsed.Draw = nil
	require.EqualExportedValues(t, full, parsed)
	require.Len(t, parsedDraw, len(fullDraw))
	for i := range fullDraw {
		switch fullDraw[i].(type) {
		case Circle:
			require.EqualExportedValues(t, fullDraw[i], parsedDraw[i])
		case Line:
			fd := fullDraw[i].(Line)
			pd := parsedDraw[i].(Line)
			fdp := fd.Points
			pdp := pd.Points
			fd.Points = nil
			pd.Points = nil
			require.EqualExportedValues(t, fd, pd)
			require.Len(t, pdp, len(fdp))
		}
	}
}

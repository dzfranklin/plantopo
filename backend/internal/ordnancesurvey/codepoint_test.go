package ordnancesurvey

import (
	"archive/zip"
	"bytes"
	"context"
	_ "embed"
	"github.com/dzfranklin/plantopo/backend/internal/pslices"
	"github.com/dzfranklin/plantopo/backend/internal/ptest"
	"github.com/stretchr/testify/require"
	"github.com/tidwall/geojson/geometry"
	"testing"
)

//go:embed test_samples/codepo_gb_sample.zip
var codepoGBSampleZip []byte

func TestParseCodePointOpenZip(t *testing.T) {
	ctx := context.Background()

	zr, zipErr := zip.NewReader(bytes.NewReader(codepoGBSampleZip), int64(len(codepoGBSampleZip)))
	require.NoError(t, zipErr)

	out := make(chan PostcodePoint)
	go func() {
		defer close(out)
		err := ParseCodePointOpenZip(ctx, zr, func(point PostcodePoint) error {
			out <- point
			return nil
		})
		require.NoError(t, err)
	}()

	got := pslices.CollectChan(out)

	expected := []PostcodePoint{
		{Code: "AB10 1AB", Point: geometry.Point{X: -2.096923, Y: 57.149590}},
		{Code: "AB10 1AF", Point: geometry.Point{X: -2.096923, Y: 57.149590}},
		{Code: "AB10 1AG", Point: geometry.Point{X: -2.097004, Y: 57.149051}},
	}

	require.Len(t, got, len(expected))

outer:
	for _, expectedValue := range got {
		for _, gotValue := range got {
			if expectedValue.Code == gotValue.Code {
				ptest.AssertPointsEqual(t, expectedValue.Point, gotValue.Point)
				continue outer
			}
		}
		panic("missing " + expectedValue.Code)
	}
}

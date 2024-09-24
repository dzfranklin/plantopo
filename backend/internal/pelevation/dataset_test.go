package pelevation

import (
	"bytes"
	"context"
	"github.com/dzfranklin/plantopo/backend/internal/perrors"
	"github.com/dzfranklin/plantopo/backend/internal/ptest"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/tidwall/geojson/geometry"
	"os/exec"
	"path"
	"reflect"
	"strconv"
	"strings"
	"testing"
)

var sampleDir = path.Join(ptest.GitRoot(), "/backend/internal/pelevation/test_samples")
var datasetPath = path.Join(sampleDir, "copernicus-dem-30m.vrt")

func makeSubject(t *testing.T) *dataset {
	t.Helper()
	l := ptest.NewTestLogger(t)
	ds, err := openDataset(l, datasetPath)
	require.NoError(t, err)
	return ds
}

func Fuzz_lookupOne(f *testing.F) {
	cases := []geometry.Point{
		// Corners of Copernicus_DSM_COG_10_N00_00_E035_00_DEM.tif
		{X: 34.9998611, Y: 1.0001389},
		{X: 34.9998611, Y: 0.0001389},
		{X: 35.9998611, Y: 1.0001389},
		{X: 35.9998611, Y: 0.0001389},
		// Center of Copernicus_DSM_COG_10_N00_00_E035_00_DEM.tif
		{X: 35.4998611, Y: 0.5001389},
	}
	for _, c := range cases {
		f.Add(c.X, c.Y)
	}

	f.Fuzz(func(t *testing.T, x, y float64) {
		p := geometry.Point{X: x, Y: y}

		l := ptest.NewTestLogger(t)
		subject, err := openDataset(l, datasetPath)
		require.NoError(t, err)

		expected, shouldExist := lookupExpected(p)
		if !shouldExist {
			return
		}

		got, err := subject.lookupOne(p)
		require.NoError(t, err)

		require.Equal(t, expected, got)
	})
}

func lookupExpected(p geometry.Point) (int16, bool) {
	out, runErr := exec.Command("gdallocationinfo",
		datasetPath,
		"-valonly",
		"-wgs84",
		strconv.FormatFloat(p.X, 'f', -1, 64),
		strconv.FormatFloat(p.Y, 'f', -1, 64),
	).Output()
	if _, ok := perrors.Into[*exec.ExitError](runErr); ok {
		return 0, false
	} else if runErr != nil {
		panic(runErr)
	}
	parsed, parseErr := strconv.ParseInt(string(bytes.TrimSpace(out)), 10, 16)
	if parseErr != nil {
		panic(parseErr)
	}
	return int16(parsed), true
}

func Test_dataset_lookup(t *testing.T) {
	t.Parallel()
	subject := makeSubject(t)

	input := []geometry.Point{
		{X: 35.444, Y: 0.404},
		{X: 35.403, Y: 0.404},
		{X: 35.402, Y: 0.404},
		{X: 35.401, Y: 0.404},
	}
	got, err := subject.lookup(context.Background(), input)
	require.NoError(t, err)
	require.Len(t, got, len(input))
}

func Test_dataset_lookupOne(t *testing.T) {
	t.Parallel()
	subject := makeSubject(t)

	t.Run("data", func(t *testing.T) {
		got, err := subject.lookupOne(geometry.Point{X: 35.444, Y: 0.404})
		require.NoError(t, err)
		// Known good value from `gdallocationinfo test_samples/copernicus-dem-30m.vrt -wgs84 35.444 0.404`
		assert.Equal(t, int16(2301), got)
	})

	t.Run("no tile", func(t *testing.T) {
		got, err := subject.lookupOne(geometry.Point{X: 0, Y: 0})
		require.NoError(t, err)
		assert.Equal(t, int16(0), got)
	})
}

func Test_dataset_locationInfo(t *testing.T) {
	t.Parallel()
	subject := makeSubject(t)

	gotFiles, err := subject.locationInfo(geometry.Point{X: 35.444, Y: 0.404})
	require.NoError(t, err)

	require.Len(t, gotFiles, 1)
	got := strings.TrimPrefix(gotFiles[0], sampleDir)

	assert.Equal(t, "/Copernicus_DSM_COG_10_N00_00_E035_00_DEM.tif", got)
}

func Test_dataset_lookupLocation(t *testing.T) {
	t.Parallel()
	subject := makeSubject(t)
	pixel, line, insideBounds := subject.lookupLocation(geometry.Point{X: 35.444, Y: 0.404})
	// Known good values from `gdallocationinfo test_samples/copernicus-dem-30m.vrt -wgs84 35.444 0.404`
	assert.True(t, insideBounds)
	assert.Equal(t, 1598, pixel)
	assert.Equal(t, 2146, line)
}

func Test_parseLocationInfo(t *testing.T) {
	t.Parallel()
	tests := []struct {
		name string
		arg  string
		want []string
	}{
		{
			name: "single file",
			arg:  "<LocationInfo><File>test_samples/Copernicus_DSM_COG_10_N00_00_E035_00_DEM.tif</File></LocationInfo>",
			want: []string{"test_samples/Copernicus_DSM_COG_10_N00_00_E035_00_DEM.tif"},
		},
		{
			name: "multiple files",
			arg:  "<LocationInfo><File>test_samples/Copernicus_DSM_COG_10_N00_00_E035_00_DEM.tif</File><File>test_samples/Copernicus_DSM_COG_10_N01_00_E035_00_DEM.tif</File></LocationInfo>",
			want: []string{"test_samples/Copernicus_DSM_COG_10_N00_00_E035_00_DEM.tif", "test_samples/Copernicus_DSM_COG_10_N01_00_E035_00_DEM.tif"},
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got, err := parseLocationInfo(tt.arg); !reflect.DeepEqual(got, tt.want) {
				require.NoError(t, err)
				t.Errorf("parseLocationInfo(%s) = %v, want %v", tt.arg, got, tt.want)
			}
		})
	}
}

package pgeograph

import (
	"bytes"
	_ "embed"
	"github.com/dzfranklin/plantopo/backend/internal/ptest"
	"github.com/dzfranklin/plantopo/backend/internal/ptime"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"testing"
)

// NOTE: I hand-edited the sample files

//go:embed test_samples/gridimage_base_sample.mysql.gz
var sampleGridimageBase []byte

//go:embed test_samples/gridimage_size_sample.mysql.gz
var sampleGridimageSize []byte

func TestParseSample(t *testing.T) {
	// TODO:
	t.Skip("TODO")
	l := ptest.NewTestLogger(t)
	baseR := bytes.NewReader(sampleGridimageBase)
	sizeR := bytes.NewReader(sampleGridimageSize)

	nextCutoff, gridimages, err := parseDump(l, -1, baseR, sizeR)
	require.NoError(t, err)

	assert.Equal(t, 12, nextCutoff)
	assert.Len(t, gridimages, 9)

	expected := gridimage{
		GridimageID:    5,
		UserID:         5,
		Realname:       "Helena Downton",
		Title:          "Lake at Woodchester Park",
		ImageTaken:     ptime.DayStart(2004, 6, 29),
		WGS84Lat:       51.711956,
		WGS84Long:      -2.254684,
		OriginalWidth:  1024,
		OriginalHeight: 1024,
	}
	got := *gridimages[5]

	assert.Equal(t, expected, got)
}

func TestParseWithCutoff(t *testing.T) {
	// TODO:
	t.Skip("TODO")
	l := ptest.NewTestLogger(t)
	baseR := bytes.NewReader(sampleGridimageBase)
	sizeR := bytes.NewReader(sampleGridimageSize)

	nextCutoff, gridimages, err := parseDump(l, 1014, baseR, sizeR)
	require.NoError(t, err)

	assert.Equal(t, 1015, nextCutoff)
	assert.Len(t, gridimages, 1)
}

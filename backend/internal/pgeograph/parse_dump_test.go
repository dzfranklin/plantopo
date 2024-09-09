package pgeograph

import (
	"bytes"
	"compress/gzip"
	_ "embed"
	"github.com/dzfranklin/plantopo/backend/internal/ptime"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"io"
	"testing"
)

// NOTE: I hand-edited the sample files

//go:embed test_samples/gridimage_base.tsv
var sampleGridimageBase []byte

//go:embed test_samples/gridimage_size.tsv
var sampleGridimageSize []byte

func compressedReader(v []byte) io.Reader {
	var b bytes.Buffer
	w, err := gzip.NewWriterLevel(&b, gzip.NoCompression)
	if err != nil {
		panic(err)
	}
	if _, wErr := w.Write(v); wErr != nil {
		panic(wErr)
	}
	if wErr := w.Close(); wErr != nil {
		panic(wErr)
	}

	return &b
}

func TestParseSample(t *testing.T) {
	baseFile := compressedReader(sampleGridimageBase)
	sizeFile := compressedReader(sampleGridimageSize)

	_, gridimages, err := parseDump(-1, baseFile, sizeFile)
	require.NoError(t, err)

	earlyExpected := gridimage{
		GridimageID:    4,
		UserID:         5,
		Realname:       "Helena Downton",
		Title:          "Woodchester Mansion",
		ImageTaken:     ptime.DayStart(2004, 06, 29),
		WGS84Lat:       51.710646,
		WGS84Long:      -2.277400,
		Width:          640,
		Height:         480,
		OriginalWidth:  0,
		OriginalHeight: 0,
	}
	assert.Equal(t, earlyExpected, *gridimages[4])

	lateExpected := gridimage{
		GridimageID:    7870834,
		UserID:         26362,
		Realname:       "Jim Barton",
		Title:          "Waulkmill and Queen Mary's Bridge, Minnigaff",
		ImageTaken:     ptime.DayStart(2024, 9, 3),
		WGS84Lat:       54.971828,
		WGS84Long:      -4.480424,
		Width:          640,
		Height:         424,
		OriginalWidth:  1600,
		OriginalHeight: 1060,
	}
	assert.Equal(t, lateExpected, *gridimages[7870834])

	assert.Equal(t, "Chûn Quoit", gridimages[655].Title, "non-ascii")

	assert.Equal(t, `"Beggars Bridge" Glaisdale.`, gridimages[149].Title, "internal quotes")

	assert.Equal(t, "The \tRattlebone Inn, Sherston", gridimages[6246853].Title, "escaped tab")
}

func TestParseWithCutoff(t *testing.T) {
	baseFile := compressedReader(sampleGridimageBase)
	sizeFile := compressedReader(sampleGridimageSize)

	nextCutoff, gridimages, err := parseDump(7870832, baseFile, sizeFile)
	require.NoError(t, err)

	assert.Equal(t, 7870834, nextCutoff)
	assert.Len(t, gridimages, 2)
}

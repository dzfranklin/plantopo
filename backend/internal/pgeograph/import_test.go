package pgeograph

import (
	"bytes"
	"github.com/dzfranklin/plantopo/backend/internal/prepo"
	"github.com/dzfranklin/plantopo/backend/internal/ptest"
	"github.com/dzfranklin/plantopo/backend/internal/ptime"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	"os"
	"testing"
)

var sampleSecret = []byte("sample_secret")

func TestImportFull(t *testing.T) {
	t.Skip()

	baseR, err := os.Open("/tmp/gridimage_base.mysql.gz")
	if err != nil {
		panic(err)
	}

	sizeR, err := os.Open("/tmp/gridimage_size.mysql.gz")
	if err != nil {
		panic(err)
	}

	l := ptest.NewTestLogger(t)

	repo := NewMockImportRepo(t)
	repo.EXPECT().GetGeographIndexProgress().Once().Return(0, nil)
	repo.EXPECT().UpdateGeographIndexProgress(mock.Anything).Return(nil)
	repo.EXPECT().ImportIfNotPresent(mock.Anything).Return(nil)

	err = importFiles(l, sampleSecret, repo, baseR, sizeR)
	require.NoError(t, err)
}

func Test_importFiles(t *testing.T) {
	l := ptest.NewTestLogger(t)

	baseR := bytes.NewReader(sampleGridimageBase)
	sizeR := bytes.NewReader(sampleGridimageSize)

	repo := NewMockImportRepo(t)

	repo.EXPECT().GetGeographIndexProgress().Once().Return(0, nil)
	repo.EXPECT().UpdateGeographIndexProgress(12).Once().Return(nil)
	repo.EXPECT().ImportIfNotPresent(mock.Anything).Times(9).Return(nil)

	err := importFiles(l, sampleSecret, repo, baseR, sizeR)
	require.NoError(t, err)
}

func Test_mapToGeophoto(t *testing.T) {
	indexedAt := ptime.DayStart(2020, 01, 01)
	tests := []struct {
		name string
		arg  gridimage
		want prepo.Geophoto
	}{
		{
			"old",
			gridimage{
				GridimageID:    5,
				UserID:         5,
				Realname:       "Helena Downton",
				Title:          "Lake at Woodchester Park",
				ImageTaken:     ptime.DayStart(2004, 6, 29),
				WGS84Lat:       51.711956,
				WGS84Long:      -2.254684,
				Width:          640,
				Height:         480,
				OriginalWidth:  0,
				OriginalHeight: 0,
			},
			prepo.Geophoto{
				Source:          2,
				SourceID:        "5",
				IndexedAt:       indexedAt,
				AttributionText: "Helena Downton (geograph.org.uk)",
				AttributionLink: "https://www.geograph.org.uk/photo/5",
				Licenses:        []int{11},
				URL:             "https://s0.geograph.org.uk/photos/00/00/000005_0c432968.jpg",
				Width:           640,
				Height:          480,
				SmallURL:        "https://s0.geograph.org.uk/photos/00/00/000005_0c432968.jpg",
				SmallWidth:      640,
				SmallHeight:     480,
				Lng:             -2.254684,
				Lat:             51.711956,
				Title:           "Lake at Woodchester Park",
				DateTaken:       ptime.DayStart(2004, 6, 29),
			},
		},
		{
			"recent",
			gridimage{
				GridimageID:    7868235,
				UserID:         9905,
				Realname:       "Robin Webster",
				Title:          "Public footpath 4Ba, Balcombe",
				ImageTaken:     ptime.DayStart(2024, 8, 21),
				WGS84Lat:       51.071143,
				WGS84Long:      -0.110185,
				Width:          640,
				Height:         480,
				OriginalWidth:  1024,
				OriginalHeight: 768,
			},
			prepo.Geophoto{
				Source:          2,
				SourceID:        "7868235",
				IndexedAt:       indexedAt,
				AttributionText: "Robin Webster (geograph.org.uk)",
				AttributionLink: "https://www.geograph.org.uk/photo/7868235",
				Licenses:        []int{11},
				URL:             "https://s0.geograph.org.uk/geophotos/07/86/82/7868235_9a9aaaa7_original.jpg",
				Width:           1024,
				Height:          768,
				SmallURL:        "https://s0.geograph.org.uk/geophotos/07/86/82/7868235_9a9aaaa7.jpg",
				SmallWidth:      640,
				SmallHeight:     480,
				Lng:             -0.110185,
				Lat:             51.071143,
				Title:           "Public footpath 4Ba, Balcombe",
				DateTaken:       ptime.DayStart(2024, 8, 21),
			},
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := mapToGeophoto(sampleSecret, tt.arg)

			assert.NotZero(t, got.IndexedAt)
			got.IndexedAt = indexedAt

			assert.Equalf(t, tt.want, got, "mapToGeophoto(%v)", tt.arg)
		})
	}
}

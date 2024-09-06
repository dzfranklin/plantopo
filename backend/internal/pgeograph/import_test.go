package pgeograph

import (
	"bytes"
	"github.com/dzfranklin/plantopo/backend/internal/prepo"
	"github.com/dzfranklin/plantopo/backend/internal/ptest"
	"github.com/dzfranklin/plantopo/backend/internal/ptime"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	"testing"
)

func Test_importFiles(t *testing.T) {
	l := ptest.NewTestLogger(t)

	baseR := bytes.NewReader(sampleGridimageBase)
	sizeR := bytes.NewReader(sampleGridimageSize)

	repo := NewMockImportRepo(t)

	repo.EXPECT().GetGeographIndexProgress().Once().Return(0, nil)
	repo.EXPECT().UpdateGeographIndexProgress(12).Once().Return(nil)
	repo.EXPECT().ImportIfNotPresent(mock.Anything).Times(9).Return(nil)

	err := importFiles(l, repo, baseR, sizeR)
	require.NoError(t, err)
}

func Test_mapToGeophoto(t *testing.T) {
	// TODO:
	t.Skip("TODO")
	indexedAt := ptime.DayStart(2020, 01, 01)
	tests := []struct {
		name string
		arg  gridimage
		want prepo.Geophoto
	}{
		{
			"basic",
			gridimage{
				GridimageID: 5,
				UserID:      3,
				Realname:    "Helena Downton",
				Title:       "Lake at Woodchester Park",
				ImageTaken:  ptime.DayStart(2004, 6, 29),
				WGS84Lat:    51.711956,
				WGS84Long:   -2.254684,
			},
			prepo.Geophoto{
				Source:          2,
				SourceID:        "5",
				IndexedAt:       indexedAt,
				AttributionText: "Helena Downton (geograph.org.uk)",
				AttributionLink: "https://www.geograph.org.uk/photo/5",
				Licenses:        []int{11},
				// TODO:
				URL:         "https://s0.geograph.org.uk/photos/00/00/000005_10a8b58c.jpg",
				Width:       640,
				Height:      480,
				SmallURL:    "",
				SmallWidth:  0,
				SmallHeight: 0,
				Lng:         -2.254684,
				Lat:         51.711956,
				Title:       "Lake at Woodchester Park",
				DateTaken:   ptime.DayStart(2004, 6, 29),
			},
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := mapToGeophoto(tt.arg)

			assert.NotZero(t, got.IndexedAt)
			got.IndexedAt = indexedAt

			assert.Equalf(t, tt.want, got, "mapToGeophoto(%v)", tt.arg)
		})
	}
}

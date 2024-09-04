package pflickr

import (
	"context"
	"github.com/dzfranklin/plantopo/backend/internal/ptime"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	"github.com/tidwall/geojson/geometry"
	"testing"
	"time"
)

func TestIndexStep(t *testing.T) {
	ctx := context.Background()

	target := targetInfo{
		Region:    geometry.Rect{Min: geometry.Point{X: 1, Y: 1}, Max: geometry.Point{X: 2, Y: 2}},
		MinUpload: ptime.DayStart(2020, 1, 1),
		MaxUpload: ptime.DayEnd(2023, time.December, 31),
	}

	searcher := NewMockflickrSearcher(t)
	returnPage := searchPage{
		Page:    1,
		Pages:   5,
		PerPage: 2,
		Photo: []searchPagePhoto{
			{DateUpload: fuzzyDate(target.MinUpload)},
			{DateUpload: fuzzyDate(target.MinUpload.AddDate(0, 1, 0))},
		},
	}
	searcher.EXPECT().searchForIndex(mock.Anything, searchParams{
		BBox:          target.Region,
		MinUploadDate: target.MinUpload,
		MaxUploadDate: target.MaxUpload,
		Page:          1,
	}).Return(returnPage, nil)

	gotPhotos, gotTarget, done, gotErr := indexStep(ctx, target, searcher)
	require.NoError(t, gotErr)

	expectedTarget := targetInfo{
		Region:    target.Region,
		MinUpload: time.Time(returnPage.Photo[len(returnPage.Photo)-1].DateUpload),
		MaxUpload: target.MaxUpload,
	}
	require.Equal(t, expectedTarget, gotTarget)

	require.Equal(t, false, done)

	require.Len(t, gotPhotos, 2)
}

func TestIndexStepZero(t *testing.T) {
	ctx := context.Background()

	target := targetInfo{
		Region:    geometry.Rect{Min: geometry.Point{X: 1, Y: 1}, Max: geometry.Point{X: 2, Y: 2}},
		MinUpload: ptime.DayStart(2020, 1, 1),
		MaxUpload: ptime.DayEnd(2023, time.December, 31),
	}

	searcher := NewMockflickrSearcher(t)
	returnPage := searchPage{
		Page:    1,
		Pages:   1,
		PerPage: 2,
		Photo:   nil,
	}
	searcher.EXPECT().searchForIndex(mock.Anything, searchParams{
		BBox:          target.Region,
		MinUploadDate: target.MinUpload,
		MaxUploadDate: target.MaxUpload,
		Page:          1,
	}).Return(returnPage, nil)

	gotPhotos, gotTarget, done, gotErr := indexStep(ctx, target, searcher)
	require.NoError(t, gotErr)
	require.Equal(t, target, gotTarget)
	require.Equal(t, true, done)
	require.Len(t, gotPhotos, 0)
}

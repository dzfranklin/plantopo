package pflickr

import (
	"context"
	"github.com/tidwall/geojson/geometry"
	"time"
)

type flickrSearcher interface {
	searchForIndex(ctx context.Context, params searchParams) (searchPage, error)
}

type targetInfo struct {
	Region    geometry.Rect
	MinUpload time.Time // inclusive
	MaxUpload time.Time // inclusive
}

// indexStep searches and advances target.
//
// This will return some duplicate photos on successive invocations.
func indexStep(
	ctx context.Context,
	target targetInfo,
	searcher flickrSearcher,
) ([]searchPagePhoto, targetInfo, error) {
	page, err := searcher.searchForIndex(ctx, searchParams{
		BBox:          target.Region,
		MinUploadDate: target.MinUpload,
		MaxUploadDate: target.MaxUpload,
		Page:          1,
	})
	if err != nil {
		return nil, target, err
	}

	if len(page.Photo) == 0 {
		return nil, target, nil
	}

	newTarget := target
	newTarget.MinUpload = time.Time(page.Photo[len(page.Photo)-1].DateUpload)

	return page.Photo, newTarget, nil
}

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
) ([]searchPagePhoto, targetInfo, bool, error) {
	page, err := searcher.searchForIndex(ctx, searchParams{
		BBox:          target.Region,
		MinUploadDate: target.MinUpload,
		MaxUploadDate: target.MaxUpload,
		Page:          1,
	})
	if err != nil {
		return nil, target, false, err
	}

	done := page.Page >= page.Pages

	if len(page.Photo) == 0 {
		return nil, target, done, nil
	}

	newTarget := target
	newTarget.MinUpload = time.Time(page.Photo[len(page.Photo)-1].DateUpload)

	return page.Photo, newTarget, done, nil
}

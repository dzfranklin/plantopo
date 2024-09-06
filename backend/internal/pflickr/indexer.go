package pflickr

import (
	"context"
	"github.com/tidwall/geojson/geometry"
	"log/slog"
	"time"
)

type flickrSearcher interface {
	searchForIndex(ctx context.Context, params searchParams) (searchPage, error)
}

type targetInfo struct {
	Region    geometry.Rect
	MaxUpload time.Time // inclusive
	MinUpload time.Time // inclusive
	Page      int
}

// indexStep searches and advances target.
//
// This will return some duplicate photos on successive invocations.
func indexStep(
	ctx context.Context,
	l *slog.Logger,
	target targetInfo,
	searcher flickrSearcher,
) ([]searchPagePhoto, targetInfo, bool, error) {
	if target.Page == 0 {
		target.Page = 1
	}

	params := searchParams{
		BBox:          target.Region,
		MaxUploadDate: target.MaxUpload,
		MinUploadDate: target.MinUpload,
		Page:          target.Page,
	}
	l.Info("searchForIndex", "params", params)
	page, err := searcher.searchForIndex(ctx, params)
	if err != nil {
		return nil, target, false, err
	}

	done := page.Page >= page.Pages

	if len(page.Photo) == 0 {
		return nil, target, done, nil
	}

	newTarget := target
	newTarget.Page = target.Page + 1

	if page.PerPage*newTarget.Page >= 3000 {
		newTarget.MinUpload = time.Time(page.Photo[len(page.Photo)-1].DateUpload)
		newTarget.Page = 1

		if newTarget.MinUpload.Before(target.MinUpload) || newTarget.MinUpload.Equal(target.MinUpload) {
			l.Warn("skipping to prevent an infinite loop")
			newTarget.MinUpload = target.MinUpload.Add(time.Minute)
		}
	}

	return page.Photo, newTarget, done, nil
}

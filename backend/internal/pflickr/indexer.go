package pflickr

import (
	"context"
	"errors"
	"fmt"
	"github.com/dzfranklin/plantopo/backend/internal/pconfig"
	"github.com/dzfranklin/plantopo/backend/internal/prepo"
	"github.com/dzfranklin/plantopo/backend/internal/ptime"
	"log/slog"
	"math"
	"time"
)

const (
	flickrSource         = 1
	indexUploadedSince   = time.Hour * 24 * 90
	waitBeforeReindexing = time.Hour * 24 * 7
)

var flickrFounding = ptime.DayStart(2005, time.July, 27)

type indexerSearcher interface {
	searchForIndex(ctx context.Context, params searchParams) (searchPage, error)
}

type indexerRepo interface {
	ImportIfNotPresent(photo prepo.Geophoto) error
	FlickrIndexRegions() ([]prepo.FlickrIndexRegion, error)
	GetFlickrIndexProgress(region int) (time.Time, error)
	UpdateFlickrIndexProgress(region int, latest time.Time) error
}

type clockProvider interface {
	Now() time.Time
}

type Indexer struct {
	l      *slog.Logger
	flickr indexerSearcher
	repo   indexerRepo
	clock  clockProvider
}

func NewIndexer(env *pconfig.Env) *Indexer {
	return &Indexer{
		l:      env.Logger.With("app", "pflickr"),
		flickr: NewAPI(env),
		repo:   prepo.New(env).Geophotos,
		clock:  systemClockProvider{},
	}
}

func (i *Indexer) IndexOnce(ctx context.Context) (bool, error) {
	regions, regionsErr := i.repo.FlickrIndexRegions()
	if regionsErr != nil {
		return false, regionsErr
	}

	didIndex := false
	for _, region := range regions {
		didIndexRegion, regionErr := i.indexRegion(ctx, region)
		if regionErr != nil {
			return false, regionErr
		}

		if didIndexRegion {
			didIndex = true
		}
	}

	return didIndex, nil
}

func (i *Indexer) indexRegion(ctx context.Context, region prepo.FlickrIndexRegion) (bool, error) {
	startTime, startErr := i.repo.GetFlickrIndexProgress(region.ID)
	if startErr != nil {
		return false, startErr
	}
	if startTime.IsZero() {
		startTime = flickrFounding
	}

	if i.clock.Now().Sub(startTime) < indexUploadedSince+waitBeforeReindexing {
		i.l.Debug("not ready for reindex")
		return false, nil
	}

	cutoff := i.clock.Now().Add(-indexUploadedSince)

	maxSearchWindow := time.Hour * 24 * 90
	minSearchWindow := time.Minute
	searchWindow := time.Hour

	params := searchParams{
		BBox:          region.Rect,
		MinUploadDate: startTime,
		MaxUploadDate: ptime.Min(startTime.Add(searchWindow), cutoff),
		Page:          1,
	}

	latestSeen := startTime
	escapingRun := false

	count := 0
	noURL := 0
	noGeo := 0

	for {
		if err := ctx.Err(); err != nil {
			return false, err
		}

		searchStart := time.Now()
		page, pageErr := i.flickr.searchForIndex(ctx, params)
		searchElapsed := time.Since(searchStart)
		if pageErr != nil {
			return false, pageErr
		}

		if len(page.Photo) > 0 {
			escapingRun = false
		}

		if page.Page <= page.Pages {
			for _, entry := range page.Photo {
				if err := ctx.Err(); err != nil {
					return false, err
				}

				photo := i.mapPhoto(entry, region.ID)

				if photo.URL == "" {
					noURL++
					continue
				}
				if math.Abs(photo.Lat) < 0.001 && math.Abs(photo.Lng) < 0.001 {
					noGeo++
					continue
				}

				if time.Time(entry.DateUpload).After(cutoff) {
					continue
				}

				if err := i.repo.ImportIfNotPresent(photo); err != nil {
					return false, err
				}

				count++
				latestSeen = ptime.Max(latestSeen, time.Time(entry.DateUpload))
			}
		}

		i.l.Info("searched", "region", region.ID, "len", len(page.Photo),
			"min", params.MinUploadDate, "max", params.MaxUploadDate, "page", params.Page,
			"searchWindow", fmt.Sprintf("%dd", searchWindow/(24*time.Hour)),
			"latestSeen", latestSeen, "searchElapsed", searchElapsed.Seconds(), "escapingRun", escapingRun,
			"count", count, "noURL", noURL, "noGeo", noGeo)

		if len(page.Photo) == 0 && latestSeen != startTime && !escapingRun && latestSeen.Before(cutoff) {
			// Sometimes flickr spuriously returns no results. Using a smaller date window seems to resolve the issue.
			// Since the date range is inclusive we should have gotten an overlap with at least the latestSeen photo.
			//
			// To resolve the issue we try re-running the previous request with a smaller window. We hope we've picked
			// a small enough initial search window that this issue won't show up because we have no way to detect it
			// until we see our first photo (the prev latestSeen could have been deleted).
			if searchWindow == minSearchWindow {
				return count > 0, errors.New("zero page but searchWindow already min")
			}
			searchWindow = max(searchWindow/2, minSearchWindow)
			params.MaxUploadDate = params.MinUploadDate.Add(searchWindow)
			i.l.Info("reduced searchWindow to try and fix zero page", "newSearchWindow", searchWindow)
			continue
		}

		passedCutoff := latestSeen.Equal(cutoff) || latestSeen.After(cutoff)
		wouldHaveSeenLast := params.Page >= page.Pages &&
			(params.MaxUploadDate.Equal(cutoff) || params.MaxUploadDate.After(cutoff))
		if passedCutoff || wouldHaveSeenLast {
			if err := i.repo.UpdateFlickrIndexProgress(region.ID, latestSeen); err != nil {
				return false, err
			}
			return count > 0, nil
		}

		pastEffectivePaginationWindow := (params.Page+1)*page.PerPage > 3000
		wouldBePastFinalPage := page.Page+1 > page.Pages
		if pastEffectivePaginationWindow || wouldBePastFinalPage {
			if err := i.repo.UpdateFlickrIndexProgress(region.ID, latestSeen); err != nil {
				return false, err
			}

			if params.Page > 10 {
				searchWindow = max(minSearchWindow, searchWindow/2)
			} else if params.Page < 4 {
				searchWindow = min(maxSearchWindow, searchWindow*2)
			}

			if params.Page == 1 && len(page.Photo) == 0 {
				params.MinUploadDate = params.MaxUploadDate
			} else if len(page.Photo) != 0 && !latestSeen.After(params.MinUploadDate) {
				// we are stuck in a run of more than our window with the same upload date, skip
				// Since we won't be able to detect a spurious zero reduce the window to try and avoid
				i.l.Info("stuck in run, bumping min to escape")
				params.MinUploadDate = latestSeen.Add(time.Second)
				searchWindow = minSearchWindow
				escapingRun = true
			} else {
				params.MinUploadDate = latestSeen
			}
			params.MaxUploadDate = params.MinUploadDate.Add(searchWindow)
			params.Page = 1
			continue
		}
		params.Page++
	}
}

func (i *Indexer) mapPhoto(photo searchPagePhoto, indexRegionID int) prepo.Geophoto {
	var url string
	var width, height int
	if photo.OriginalURL != "" {
		url = photo.OriginalURL
		width = photo.OriginalWidth
		height = photo.OriginalHeight
	} else if photo.LargeURL != "" {
		url = photo.LargeURL
		width = photo.LargeWidth
		height = photo.LargeHeight
	}

	return prepo.Geophoto{
		Source:          flickrSource,
		SourceID:        photo.ID,
		IndexRegionID:   indexRegionID,
		IndexedAt:       i.clock.Now(),
		AttributionText: fmt.Sprintf("%s (flickr)", photo.OwnerName),
		AttributionLink: fmt.Sprintf("https://flickr.com/photos/%s/%s", photo.Owner, photo.ID),
		Licenses:        []int{photo.License},
		URL:             url,
		Width:           width,
		Height:          height,
		SmallURL:        photo.SmallURL,
		SmallWidth:      photo.SmallWidth,
		SmallHeight:     photo.SmallHeight,
		Lng:             float64(photo.Longitude),
		Lat:             float64(photo.Latitude),
		Title:           photo.Title,
		DateUploaded:    time.Time(photo.DateUpload),
		DateTaken:       time.Time(photo.DateTaken),
	}
}

type systemClockProvider struct{}

func (p systemClockProvider) Now() time.Time {
	return time.Now()
}

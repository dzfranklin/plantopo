package pflickr

import (
	"context"
	"fmt"
	"github.com/dzfranklin/plantopo/backend/internal/pconfig"
	"github.com/dzfranklin/plantopo/backend/internal/prepo"
	"github.com/dzfranklin/plantopo/backend/internal/ptime"
	"log/slog"
	"math"
	"time"
)

const (
	flickrSource        = 1
	reindexAfterElapsed = time.Hour * 24 * 30
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

type Indexer struct {
	l      *slog.Logger
	flickr indexerSearcher
	repo   indexerRepo
}

func NewIndexer(env *pconfig.Env) *Indexer {
	return &Indexer{
		l:      env.Logger,
		flickr: NewAPI(env),
		repo:   prepo.New(env).Geophotos,
	}
}

func (i *Indexer) IndexOnce(ctx context.Context) error {
	regions, regionsErr := i.repo.FlickrIndexRegions()
	if regionsErr != nil {
		return regionsErr
	}

	for _, region := range regions {
		if err := i.indexRegion(ctx, region); err != nil {
			return err
		}
	}

	return nil
}

func (i *Indexer) indexRegion(ctx context.Context, region prepo.FlickrIndexRegion) error {
	startTime, startErr := i.repo.GetFlickrIndexProgress(region.ID)
	if startErr != nil {
		return startErr
	}
	if startTime.IsZero() {
		startTime = flickrFounding
	}

	if time.Since(startTime) < reindexAfterElapsed {
		i.l.Debug("not ready for reindex")
		return nil
	}

	cutoff := time.Now().Add(-reindexAfterElapsed)
	searchWindow := time.Hour * 24 * 100
	maxSearchWindow := time.Hour * 24 * 365
	minSearchWindow := time.Hour

	params := searchParams{
		BBox:          region.Rect,
		MinUploadDate: startTime,
		MaxUploadDate: ptime.Min(startTime.Add(searchWindow), cutoff),
		Page:          1,
	}

	latestSeen := startTime

	count := 0
	noURL := 0
	noGeo := 0

	for {
		if err := ctx.Err(); err != nil {
			return err
		}

		searchStart := time.Now()
		page, pageErr := i.flickr.searchForIndex(ctx, params)
		searchElapsed := time.Since(searchStart)
		if pageErr != nil {
			return pageErr
		}

		i.l.Info("searched", "region", region.ID, "len", len(page.Photo),
			"min", params.MinUploadDate, "max", params.MaxUploadDate, "page", params.Page,
			"searchWindow", fmt.Sprintf("%dd", searchWindow/(24*time.Hour)),
			"latestSeen", latestSeen, "searchElapsed", searchElapsed.Seconds(),
			"count", count, "noURL", noURL, "noGeo", noGeo)

		if page.Page <= page.Pages {
			for _, entry := range page.Photo {
				if err := ctx.Err(); err != nil {
					return err
				}

				photo := mapPhoto(entry, region.ID)

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
					return err
				}

				count++
				latestSeen = ptime.Max(latestSeen, time.Time(entry.DateUpload))
			}
		}

		passedCutoff := latestSeen.Equal(cutoff) || latestSeen.After(cutoff)
		wouldHaveSeenLast := params.Page >= page.Pages &&
			(params.MaxUploadDate.Equal(cutoff) || params.MaxUploadDate.After(cutoff))
		if passedCutoff || wouldHaveSeenLast {
			return nil
		}

		pastEffectivePaginationWindow := (params.Page+1)*page.PerPage > 3000
		wouldBePastFinalPage := page.Page+1 > page.Pages
		if pastEffectivePaginationWindow || wouldBePastFinalPage {
			if err := i.repo.UpdateFlickrIndexProgress(region.ID, latestSeen); err != nil {
				return err
			}

			if params.Page > 10 {
				searchWindow = max(minSearchWindow, searchWindow/2)
			} else if params.Page < 4 {
				searchWindow = min(maxSearchWindow, searchWindow*2)
			}

			params.MinUploadDate = params.MaxUploadDate
			params.MaxUploadDate = ptime.Min(params.MinUploadDate.Add(searchWindow), cutoff)
			params.Page = 1
			continue
		}
		params.Page++
	}
}

func mapPhoto(photo searchPagePhoto, indexRegionID int) prepo.Geophoto {
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
		IndexedAt:       time.Now(),
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
		DateTaken:       time.Time(photo.DateTaken),
	}
}

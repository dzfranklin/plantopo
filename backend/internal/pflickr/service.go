package pflickr

import (
	"context"
	"fmt"
	"github.com/bsm/redislock"
	"github.com/dzfranklin/plantopo/backend/internal/pconfig"
	"github.com/dzfranklin/plantopo/backend/internal/prepo"
	"github.com/dzfranklin/plantopo/backend/internal/pslices"
	"github.com/dzfranklin/plantopo/backend/internal/ptime"
	"log/slog"
	"math"
	"time"
)

const (
	flickrSource        = 1
	reindexAfterElapsed = time.Hour * 24 * 30
)

type Service struct {
	l      *slog.Logger
	api    *API
	repo   *prepo.Geophotos
	locker *redislock.Client
}

func NewService(env *pconfig.Env) *Service {
	return &Service{
		l:      env.Logger.With("app", "pflickr.Service"),
		api:    NewAPI(env),
		repo:   prepo.New(env).Geophotos,
		locker: redislock.New(env.RDB),
	}
}

func (s *Service) IndexFlickr(ctx context.Context) error {
	for {
		regions, regionsErr := s.repo.FlickrIndexRegions()
		if regionsErr != nil {
			return regionsErr
		}
		pslices.SortBy(regions, func(r prepo.FlickrIndexRegion) string { return r.Name })

		for _, region := range regions {
			if err := s.indexFlickrRegion(ctx, region); err != nil {
				return err
			}
		}

		if err := ptime.Sleep(ctx, time.Hour); err != nil {
			return err
		}
	}
}

func (s *Service) indexFlickrRegion(ctx context.Context, region prepo.FlickrIndexRegion) error {
	l := s.l.With("region", region.Name, "regionID", region.ID)

	startTime, startErr := s.repo.GetFlickrIndexProgress(region.ID)
	if startErr != nil {
		return startErr
	}

	if time.Since(startTime) < reindexAfterElapsed {
		l.Debug("not ready for reindex")
		return nil
	}

	target := targetInfo{
		Region:    region.Rect,
		MinUpload: startTime,
		MaxUpload: time.Now(),
	}

	count := 0
	noURL := 0
	noGeo := 0
	completed := false
	defer func() {
		l = l.With(
			"count", count,
			"start", startTime,
			"end", target.MinUpload,
			"noURL", noURL,
			"noGeo", noGeo,
		)
		if completed {
			l.Info("completed index of region")
		} else {
			l.Info("interrupted index of region")
		}
	}()

	for {
		if err := ctx.Err(); err != nil {
			return err
		}
		var stepErr error
		var stepPhotos []searchPagePhoto
		var done bool
		stepPhotos, target, done, stepErr = indexStep(ctx, l, target, s.api)
		if stepErr != nil {
			return stepErr
		}

		if done {
			if err := s.repo.UpdateFlickrIndexProgress(region.ID, time.Now().Add(-time.Hour)); err != nil {
				return err
			}
			completed = true
			return nil
		}

		for _, entry := range stepPhotos {
			photo := mapPhoto(entry, region.ID)

			if photo.URL == "" {
				noURL++
				continue
			}
			if math.Abs(photo.Lat) < 0.001 && math.Abs(photo.Lng) < 0.001 {
				noGeo++
				continue
			}

			if err := s.repo.ImportIfNotPresent(photo); err != nil {
				return err
			}
			count++
		}

		if err := s.repo.UpdateFlickrIndexProgress(region.ID, target.MinUpload); err != nil {
			return err
		}

		l.Info("index step",
			"totalCount", count, "stepCount", len(stepPhotos), "start", startTime, "reached", target.MinUpload)
	}
}

func mapPhoto(photo searchPagePhoto, indexRegionID int) prepo.Geophoto {
	var url string
	var width, height int
	if photo.OriginalURL != "" {
		url = photo.OriginalURL
		width = photo.OriginalWidth
		height = photo.OriginalHeight
	} else {
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

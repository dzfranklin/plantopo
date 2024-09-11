package papi

import (
	"context"
	"github.com/dzfranklin/plantopo/backend/internal/prepo"
	"github.com/dzfranklin/plantopo/backend/internal/pslices"
	"github.com/tidwall/geojson/geometry"
	"golang.org/x/sync/errgroup"
	"slices"
	"sync"
)

func (h *phandler) GeophotosGet(ctx context.Context, params GeophotosGetParams) (*GeophotosGetOK, error) {
	hasID := len(params.ID) != 0
	hasBounds := params.MaxLng.Set && params.MaxLat.Set && params.MinLng.Set && params.MinLat.Set
	if !(hasID || hasBounds) {
		return nil, badRequest("must specify bounds or id")
	}

	var results []prepo.Geophoto
	var mu sync.Mutex
	var grp errgroup.Group

	if hasID {
		grp.Go(func() error {
			partial, err := h.Geophotos.GetMany(ctx, params.ID)
			if err != nil {
				return err
			}

			mu.Lock()
			results = append(results, partial...)
			mu.Unlock()

			return nil
		})
	}

	if hasBounds {
		grp.Go(func() error {
			partial, err := h.Geophotos.GetWithin(ctx, geometry.Rect{
				Min: geometry.Point{X: params.MinLng.Value, Y: params.MinLat.Value},
				Max: geometry.Point{X: params.MaxLng.Value, Y: params.MaxLat.Value},
			})
			if err != nil {
				return err
			}

			mu.Lock()
			results = append(results, partial...)
			mu.Unlock()

			return nil
		})
	}

	if err := grp.Wait(); err != nil {
		return nil, err
	}

	// remove duplicates
	pslices.SortBy(results, func(r prepo.Geophoto) int { return r.ID })
	results = slices.CompactFunc(results, func(a prepo.Geophoto, b prepo.Geophoto) bool { return a.ID == b.ID })

	return &GeophotosGetOK{Photos: pslices.Map(results, mapGeophoto)}, nil
}

func mapGeophoto(entry prepo.Geophoto) Geophoto {
	var smallImage OptImage
	if entry.SmallURL != "" && entry.SmallWidth != 0 && entry.SmallHeight != 0 {
		smallImage = OptImage{Set: true, Value: Image{
			Src:    entry.SmallURL,
			Width:  entry.SmallWidth,
			Height: entry.SmallHeight,
		}}
	}

	return Geophoto{
		ID:              entry.ID,
		Source:          omitEmptyInt(entry.Source),
		SourceID:        omitEmptyString(entry.SourceID),
		IndexedAt:       omitEmptyDateTime(entry.IndexedAt),
		AttributionText: omitEmptyString(entry.AttributionText),
		AttributionLink: omitEmptyString(entry.AttributionLink),
		Licenses:        entry.Licenses,
		Image: Image{
			Src:    entry.URL,
			Width:  entry.Width,
			Height: entry.Height,
		},
		SmallImage: smallImage,
		Point:      []float64{entry.Lng, entry.Lat},
		Title:      omitEmptyString(entry.Title),
		DateTaken:  omitEmptyDateTime(entry.DateTaken),
	}
}

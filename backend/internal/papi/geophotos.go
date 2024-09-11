package papi

import (
	"context"
	"github.com/dzfranklin/plantopo/backend/internal/prepo"
	"github.com/dzfranklin/plantopo/backend/internal/pslices"
	"github.com/tidwall/geojson/geometry"
)

func (h *phandler) GeophotosGet(ctx context.Context, params GeophotosGetParams) (*GeophotosGetOK, error) {
	hasID := len(params.ID) != 0
	hasBounds := params.MaxLng.Set && params.MaxLat.Set && params.MinLng.Set && params.MinLat.Set
	if hasID && hasBounds {
		return nil, badRequest("cannot specify both ids and bounds")
	} else if hasID {
		entries, err := h.Geophotos.GetMany(ctx, params.ID)
		if err != nil {
			return nil, err
		}
		photos := pslices.Map(entries, mapGeophoto)
		return &GeophotosGetOK{Photos: photos}, nil
	} else if hasBounds {
		entries, err := h.Geophotos.GetWithin(ctx, geometry.Rect{
			Min: geometry.Point{X: params.MinLng.Value, Y: params.MinLat.Value},
			Max: geometry.Point{X: params.MaxLng.Value, Y: params.MaxLat.Value},
		})
		if err != nil {
			return nil, err
		}
		photos := pslices.Map(entries, mapGeophoto)
		return &GeophotosGetOK{Photos: photos}, nil
	} else {
		return nil, badRequest("must specify either ids or bounds")
	}
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

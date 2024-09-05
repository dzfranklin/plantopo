package papi

import (
	"bytes"
	"context"
	"github.com/dzfranklin/plantopo/backend/internal/prepo"
	"github.com/dzfranklin/plantopo/backend/internal/pslices"
	"net/http"
)

func (h *phandler) GeophotosTileZXYMvtGzGet(ctx context.Context, params GeophotosTileZXYMvtGzGetParams) (*MVTTileHeaders, error) {
	b, err := h.Repo.Geophotos.GetTile(ctx, params.Z, params.X, params.Y)
	if err != nil {
		return nil, err
	}
	return &MVTTileHeaders{
		ContentEncoding: NewOptString("gzip"),
		Response:        MVTTile{Data: bytes.NewReader(b)},
	}, nil
}

func (h *phandler) GeophotosGet(ctx context.Context, params GeophotosGetParams) (*GeophotosGetOK, error) {
	if len(params.ID) == 0 {
		return nil, &DefaultErrorResponseStatusCode{
			StatusCode: http.StatusBadRequest,
			Response:   DefaultError{Message: "missing ids"},
		}
	}

	entries, err := h.Geophotos.GetMany(ctx, params.ID)
	if err != nil {
		return nil, err
	}

	photos := pslices.Map(entries, func(entry prepo.Geophoto) Geophoto {
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
	})

	return &GeophotosGetOK{Photos: photos}, nil
}

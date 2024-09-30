package papi

import (
	"context"
	"encoding/json"
	"github.com/dzfranklin/plantopo/backend/internal/psearch"
	"github.com/dzfranklin/plantopo/backend/internal/pslices"
	"github.com/go-faster/jx"
	"github.com/tidwall/geojson/geometry"
)

func (h *phandler) GeosearchGet(ctx context.Context, params GeosearchGetParams) (*GeosearchGetOK, error) {
	query := psearch.Query{}

	query.User, _ = getAuthenticatedUser(ctx)
	query.Text = params.Text

	if params.BiasLng.Set && params.BiasLat.Set {
		query.Bias = &psearch.Bias{}

		query.Bias.Center = geometry.Point{X: params.BiasLng.Value, Y: params.BiasLat.Value}

		if params.BiasZoom.Set {
			query.Bias.Zoom = params.BiasZoom.Value
		} else {
			query.Bias.Zoom = 16
		}
	}

	if params.HigherQuality.Value {
		query.HigherQuality = true
	}

	queryResults, err := h.search.Query(ctx, query)
	if err != nil {
		return nil, err
	}

	results := pslices.Map(queryResults, mapSearchResult)

	if !params.Debug.Value {
		for i, r := range results {
			r.Debug.Reset()
			results[i] = r
		}
	}

	return &GeosearchGetOK{
		User:    omitEmptyString(query.User),
		Results: results,
	}, nil
}

func mapSearchResult(res psearch.Result) SearchResult {
	var debug OptSearchResultDebug
	if res.Debug != nil {
		value := make(map[string]jx.Raw)
		for k, v := range res.Debug {
			rawV, vErr := json.Marshal(v)
			if vErr != nil {
				continue
			}
			value[k] = rawV
		}

		debug.Set = true
		debug.Value = value
	}

	return SearchResult{
		ID:           res.ID,
		Name:         res.Name,
		Type:         mapSearchResultType(res.Type),
		CountryCode2: res.CountryCode2,
		Geometry:     mapGeometry(res.Geometry),
		Debug:        debug,
	}
}

func mapSearchResultType(v string) SearchResultType {
	switch v {
	case psearch.PostcodeType:
		return SearchResultTypePostcode
	case psearch.HillType:
		return SearchResultTypeHill
	case psearch.StreetType:
		return SearchResultTypeStreet
	case psearch.PopulatedPlaceType:
		return SearchResultTypePopulatedPlace
	case psearch.WaterBodyType:
		return SearchResultTypeWaterBody
	default:
		return SearchResultTypeOther
	}
}

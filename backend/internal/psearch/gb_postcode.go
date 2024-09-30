package psearch

import (
	"context"
	"github.com/dzfranklin/plantopo/backend/internal/prepo"
	"github.com/dzfranklin/plantopo/backend/internal/pslices"
	"github.com/tidwall/geojson"
	"strings"
)

type gbPostcodeRepo struct {
	*prepo.GBPostcode
}

func (r gbPostcodeRepo) Query(ctx context.Context, query Query) ([]Result, error) {
	results, err := r.Search(ctx, query.Text, query.BiasCenter())
	if err != nil {
		return nil, err
	}
	return pslices.Map(results, func(point prepo.GBPostcodePoint) Result {
		id := "gb_postcode:" + strings.ToLower(strings.ReplaceAll(point.Code, " ", ""))
		return Result{
			ID:           id,
			Name:         point.Code,
			CountryCode2: "GB",
			Type:         PostcodeType,
			Geometry:     geojson.NewPoint(point.Point),
			Debug:        map[string]any{"provider": "gb_postcode_repo"},
		}
	}), nil
}

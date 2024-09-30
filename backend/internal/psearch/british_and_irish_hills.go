package psearch

import (
	"context"
	"github.com/dzfranklin/plantopo/backend/internal/prepo"
	"github.com/dzfranklin/plantopo/backend/internal/pslices"
	"github.com/tidwall/geojson"
	"strconv"
)

type britishAndIrishHillsRepo struct {
	*prepo.BritishAndIrishHills
}

func (r britishAndIrishHillsRepo) Query(ctx context.Context, query Query) ([]Result, error) {
	results, err := r.TrigramSearch(ctx, query.Text)
	if err != nil {
		return nil, err
	}
	return pslices.Map(results, func(r prepo.BritishOrIrishHillSearchResult) Result {
		countryCode2 := "GB"
		if r.Country == "I" {
			countryCode2 = "IE"
		}
		return Result{
			ID:           "dobih:" + strconv.Itoa(r.ID),
			Name:         r.Name,
			matchingTerm: r.Term,
			Type:         HillType,
			CountryCode2: countryCode2,
			Geometry:     geojson.NewPoint(r.Point),
			Debug: map[string]any{
				"provider":      "british_and_irish_hills_repo",
				"matched_term":  r.Term,
				"dobih_country": r.Country,
			},
		}
	}), nil
}

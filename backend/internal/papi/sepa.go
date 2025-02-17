package papi

import (
	"context"
	"github.com/dzfranklin/plantopo/backend/internal/pgeo"
	"github.com/dzfranklin/plantopo/backend/internal/psepa"
	"slices"
	"strings"
)

func (h *phandler) SepaStationsGet(_ctx context.Context) (FeatureCollection, error) {
	stations, err := psepa.Latest()
	if err != nil {
		return nil, err
	}

	var fc pgeo.FeatureCollectionWriter
	for _, station := range stations {
		var parameterNames []string
		var parameterLongNames []string
		var hasStage = false
		var hasDischarge = false
		var hasPrecipitation = false
		for _, param := range station.Parameters {
			parameterNames = append(parameterNames, param.Name)
			parameterLongNames = append(parameterLongNames, param.LongName)

			switch param.Name {
			case "S":
				hasStage = true
			case "Q":
				hasDischarge = true
			case "Precip":
				hasPrecipitation = true
			}
		}
		slices.Sort(parameterNames)
		slices.Sort(parameterLongNames)

		props := map[string]any{
			"name":                 station.Name,
			"catchment_name":       station.CatchmentName,
			"parameter_names":      strings.Join(parameterNames, ", "),
			"parameter_long_names": strings.Join(parameterLongNames, ", "),
			"has_stage":            hasStage,
			"has_discharge":        hasDischarge,
			"has_precipitation":    hasPrecipitation,
			"levels_webpage":       "https://waterlevels.sepa.org.uk/Station/" + station.NO,
		}
		fc.WritePoint(0, station.Point, props)
	}

	return fc.Finish(), nil
}

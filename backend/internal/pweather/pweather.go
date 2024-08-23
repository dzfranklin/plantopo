package pweather

import (
	"context"
	"fmt"
	"github.com/dzfranklin/plantopo/backend/internal/metoffice"
	"github.com/dzfranklin/plantopo/backend/internal/ordnancesurvey"
	"github.com/dzfranklin/plantopo/backend/internal/pconfig"
	"github.com/paulmach/orb"
	"github.com/paulmach/orb/geo"
	"math"
	"strings"
	"time"
)

type Service struct {
	os  *ordnancesurvey.Client
	met *metoffice.Client
}

func New(env *pconfig.Env) *Service {
	return &Service{
		os:  ordnancesurvey.New(env.Config.OrdnanceSurvey.APIKey),
		met: metoffice.New(env.Config.MetOffice.DataPointAPIKey),
	}
}

func (s *Service) FindUKShortForecast(ctx context.Context, query string) (string, error) {
	query = strings.TrimSpace(query)

	// WatchStatus: Cache forecast site list
	forecastSites, err := s.met.ForecastSitelist(ctx)
	if err != nil {
		return "", err
	}

	var site *metoffice.ForecastLocation
	for _, candidate := range forecastSites {
		if strings.EqualFold(candidate.ID, query) || strings.EqualFold(candidate.Name, query) {
			site = &candidate
			break
		}
	}

	if site == nil {
		candidatePlaces, err := s.os.FindNames(ctx, query, &ordnancesurvey.FindNamesOptions{
			MaxResults: 2,
			LocalTypes: []string{
				"Airfield", "Airport", "Bay", "Beach", "Channel", "Cirque_Or_Hollow", "City", "Cliff_Or_Slope",
				"Coastal_Headland", "Estuary", "Group_Of_Islands", "Hamlet", "Harbour", "Hill_Or_Mountain",
				"Hill_Or_Mountain_Ranges", "Inland_Water", "Island", "Other_Coastal_Landform", "Other_Landcover",
				"Other_Landform", "Other_Settlement", "Postcode", "Railway_Station", "Sea", "Spot_Height",
				"Suburban_Area", "Tidal_Water", "Town", "Urban_Greenspace", "Valley", "Village", "Waterfall", "Wetland",
				"Woodland_Or_Forest",
			},
		})
		if err != nil {
			return "", err
		}
		if len(candidatePlaces) == 0 {
			return "", ErrNotFound
		}
		if len(candidatePlaces) > 1 && strings.EqualFold(candidatePlaces[0].Name1, candidatePlaces[1].Name1) {
			return "", &ErrAmbiguousPlaceName{
				Candidate1: fmt.Sprintf("%s (%s)", candidatePlaces[0].Name1, candidatePlaces[0].CountyUnitary),
				Candidate2: fmt.Sprintf("%s (%s)", candidatePlaces[1].Name1, candidatePlaces[1].CountyUnitary),
			}
		}
		place := candidatePlaces[0]

		closestDist := math.Inf(1)
		for _, candidate := range forecastSites {
			dist := geo.DistanceHaversine(
				orb.Point{candidate.Longitude, candidate.Latitude},
				orb.Point{place.Longitude, place.Latitude})
			if dist < closestDist {
				site = &candidate
				closestDist = dist
			}
		}
		if site == nil {
			panic("no candidate forecast sites")
		}
	}

	allForecasts, err := s.met.Forecast(ctx, site.ID)
	if err != nil {
		return "", err
	}

	cutoffBefore := time.Now().Add(-1 * (time.Hour*3 + time.Minute))
	cutoffAfter := time.Now().Add(time.Hour * 24)
	var forecasts []metoffice.Forecast
	for _, fc := range allForecasts {
		if fc.Time.Before(cutoffBefore) || fc.Time.After(cutoffAfter) {
			continue
		}
		forecasts = append(forecasts, fc)
	}

	var parts []string
	for i, fc := range forecasts {
		var sb strings.Builder

		if i == 0 || fc.Time.Weekday() != forecasts[i-1].Time.Weekday() {
			fmt.Fprintf(&sb, "%s %d ", fc.Time.Format("Mon"), fc.Time.Hour())
		} else {
			fmt.Fprintf(&sb, "%d ", fc.Time.Hour())
		}

		if i == 0 || fc.SignificantWeatherCode != forecasts[i-1].SignificantWeatherCode {
			fmt.Fprintf(&sb, "%s ", fc.SignificantWeatherShortDescription())
		} else {
			sb.WriteString(`" `)
		}

		fmt.Fprintf(&sb, "%.0f%% ", fc.PrecipitationProbability)

		if fc.WindGust > fc.WindSpeed+10 {
			fmt.Fprintf(&sb, "%.0fG%.0f ", fc.WindSpeed, fc.WindGust)
		} else {
			fmt.Fprintf(&sb, "%.0f ", fc.WindSpeed)
		}

		parts = append(parts, strings.TrimSpace(sb.String()))
	}

	msg := fmt.Sprintf("%s %.fm ", site.Name, site.Elevation) + strings.Join(parts, ",")

	return msg, nil
}

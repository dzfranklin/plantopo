package metoffice

import (
	"context"
	"fmt"
	"github.com/dzfranklin/plantopo/backend/internal/phttp"
	"net/url"
	"strings"
	"time"
)

type Client struct {
	c *phttp.JSONClient
}

func New(datapointAPIKey string) *Client {
	inner := phttp.NewJSONClient("http://datapoint.metoffice.gov.uk/public/data/")
	inner.AddCommonQueryParam("key", datapointAPIKey)
	return &Client{inner}
}

type ForecastLocation struct {
	Elevation       float64 `json:"elevation,string"`
	ID              string  `json:"id"`
	Latitude        float64 `json:"latitude,string"`
	Longitude       float64 `json:"longitude,string"`
	Name            string  `json:"name"`
	Region          string  `json:"region"`
	UnitaryAuthArea string  `json:"unitaryAuthArea"`
}

func (c *Client) ForecastSitelist(ctx context.Context) ([]ForecastLocation, error) {
	var results struct {
		Locations struct {
			Location []ForecastLocation `json:"Location"`
		} `json:"Locations"`
	}
	err := c.c.Get(ctx, &results, "val/wxfcs/all/json/sitelist")
	if err != nil {
		return nil, err
	}
	return results.Locations.Location, nil
}

// Forecast looks up a forecast for a site.
//
// This provides access to three hourly forecast data from the Met
// Office for each of the roughly 5,000 sites for which the Met Office provides
// data. The forecast data is provided for time steps that are three hours apart,
// or daily (day and night), starting with the time at which the forecast was
// last run, and ending approximately five days later (meaning that approximately
// 10 or 40 forecast timesteps are available for each site). The data provided by
// the web service is updated on an hourly basis, and at any given point in time
// the exact set of timesteps that are available can be obtained using the
// capabilities web service. For a full list of the 5,000 sites, call the 5,000
// UK locations site list data feed.
func (c *Client) Forecast(ctx context.Context, site string) ([]Forecast, error) {
	params := make(url.Values)
	params.Set("res", "3hourly")

	var results struct {
		SiteRep struct {
			Wx struct {
				Param []struct {
					Name        string `json:"name"`  // The attribute name in the Rep object. e.g. 'T'
					Units       string `json:"units"` // The unit in which the attribute value is represented. e.g. 'C
					Description string `json:"$"`     // A textual description of what the corresponding attribute represents in the corresponding Rep object. e.g. 'Temperature'
				} `json:"Param"`
			} `json:"Wx"`
			DV struct {
				DataDate string `json:"dataDate"`
				Type     string `json:"type"`
				Location struct {
					ID        string  `json:"i"`
					Lat       float64 `json:"lat,string"`
					Lng       float64 `json:"lon,string"`
					Name      string  `json:"name"`
					Country   string  `json:"country"`
					Continent string  `json:"continent"`
					Elevation float64 `json:"elevation,string"`
					Period    []struct {
						Type  string     `json:"type"` // Day
						Value string     `json:"value"`
						Rep   []Forecast `json:"Rep"` // A single forecast
					}
				}
			}
		} `json:"SiteRep"`
	}
	err := c.c.Get(ctx, &results, "val/wxfcs/all/json/"+site+"?"+params.Encode())
	if err != nil {
		return nil, err
	}

	gbTz, err := time.LoadLocation("Europe/London")
	if err != nil {
		return nil, fmt.Errorf("load time location Europe/London: %w", err)
	}

	var forecasts []Forecast
	for _, period := range results.SiteRep.DV.Location.Period {
		if period.Type != "Day" {
			return nil, fmt.Errorf("expected type Day, got %s", period.Type)
		}
		periodDay, err := time.Parse("2006-01-02Z", period.Value)
		if err != nil {
			return nil, fmt.Errorf("failed to parse period value: %w", err)
		}

		for _, forecast := range period.Rep {
			forecast.Time = periodDay.In(gbTz).Add(time.Duration(forecast.MinutesAfterMidnightUTC) * time.Minute)
			forecasts = append(forecasts, forecast)
		}
	}
	return forecasts, nil
}

type Forecast struct {
	Time                     time.Time
	UVIndex                  int    `json:"U,string"`
	SignificantWeatherCode   string `json:"W"`
	VisibilityInMetersOrCode string `json:"V"`
	// Ambient temperature without the effect of wind chill or heat from the sun (Celsius)
	ScreenTemperature float64 `json:"T,string"`
	// Wind speed in miles per hour (mph)
	WindSpeed float64 `json:"S,string"`
	// Precipitation Probability as a percentage (%)
	PrecipitationProbability float64 `json:"Pp,string"`
	// Screen relative humidity in percent (%)
	ScreenRelativeHumidity float64 `json:"H,string"`
	// Wind gust in miles per hour (mph)
	WindGust float64 `json:"G,string"`
	// Feels like temperature in degrees Celsius (°C)
	FeelsLikeTemperature float64 `json:"F,string"`
	// Wind direction 16-point compass direction e.g. S, SSW, SW, etc.
	WindDirection string `json:"D"`
	// The number of minutes after midnight UTC on the day represented by the Period
	// object in which the Rep object is found.
	MinutesAfterMidnightUTC int `json:"$,string"`
}

func (f Forecast) String() string {
	var sb strings.Builder
	fmt.Fprintf(&sb, "%s ", f.Time.Format("Mon 15:04"))
	fmt.Fprintf(&sb, "W %s ", f.SignificantWeatherDescription())
	fmt.Fprintf(&sb, "U %d ", f.UVIndex)
	fmt.Fprintf(&sb, "V %s ", f.VisibilityInMetersOrCode)
	fmt.Fprintf(&sb, "T %.fc ", f.ScreenTemperature)
	fmt.Fprintf(&sb, "F %.fc ", f.FeelsLikeTemperature)
	fmt.Fprintf(&sb, "Pp %.f%% ", f.PrecipitationProbability)
	fmt.Fprintf(&sb, "H %.f%% ", f.ScreenRelativeHumidity)
	fmt.Fprintf(&sb, "S %.fmph ", f.WindSpeed)
	fmt.Fprintf(&sb, "G %.fmph ", f.WindGust)
	fmt.Fprintf(&sb, "D %s ", f.WindDirection)
	return sb.String()
}

func (f Forecast) SignificantWeatherDescription() string {
	text, ok := significantWeatherDescriptions[f.SignificantWeatherCode]
	if !ok {
		return fmt.Sprintf("<unknown significant weather code %s>", f.SignificantWeatherCode)
	}
	return text
}

func (f Forecast) SignificantWeatherShortDescription() string {
	text, ok := significantWeatherShortDescriptions[f.SignificantWeatherCode]
	if !ok {
		return fmt.Sprintf("<unknown significant weather code %s>", f.SignificantWeatherCode)
	}
	return text
}

func (f Forecast) VisibilityDescription() string {
	text, ok := visibilityCodes[f.VisibilityInMetersOrCode]
	if ok {
		return text
	} else {
		return fmt.Sprintf("%s metres", f.VisibilityInMetersOrCode)
	}
}

package pgeocoding

import (
	"context"
	"errors"
	"fmt"
	"github.com/dzfranklin/plantopo/backend/internal/pconfig"
	"github.com/dzfranklin/plantopo/backend/internal/phttp"
	"net/url"
	"strconv"
	"strings"
	"time"
)

var ErrNoMatch = errors.New("no match")

type Service struct {
	mapbox *phttp.JSONClient
}

func New(cfg *pconfig.Config) *Service {
	mapbox := phttp.NewJSONClient("https://api.mapbox.com/search/geocode/v6")
	mapbox.AddCommonQueryParam("access_token", cfg.Mapbox.PrivateToken)
	return &Service{mapbox: mapbox}
}

type Opts struct {
	IPProximity   bool
	Proximity     [2]float64
	CountryAlpha2 []string
}

func (s *Service) PlaceName(lng, lat float64, opts *Opts) (string, error) {
	ctx, cancel := context.WithTimeout(context.Background(), time.Second*10)
	defer cancel()

	params := make(url.Values)

	params.Set("longitude", strconv.FormatFloat(lng, 'f', 6, 64))
	params.Set("latitude", strconv.FormatFloat(lat, 'f', 6, 64))

	params.Set("limit", "1")
	params.Set("types", "place")

	if opts != nil {
		if opts.IPProximity {
			params.Set("proximity", "ip")
		}
		if !(opts.Proximity[0] == 0 && opts.Proximity[1] == 0) {
			params.Set("proximity", fmt.Sprintf("%f,%f", opts.Proximity[0], opts.Proximity[1]))
		}
		if opts.CountryAlpha2 != nil {
			params.Set("country", strings.Join(opts.CountryAlpha2, ","))
		}
	}

	var out struct {
		Features []struct {
			Properties struct {
				Name string `json:"name"`
			} `json:"properties"`
		} `json:"features"`
	}
	if err := s.mapbox.Get(ctx, &out, "reverse?"+params.Encode()); err != nil {
		return "", err
	}

	if len(out.Features) == 0 {
		return "", ErrNoMatch
	}
	return out.Features[0].Properties.Name, nil
}

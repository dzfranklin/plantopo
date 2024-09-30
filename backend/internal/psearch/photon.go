package psearch

import (
	"context"
	"encoding/json"
	"fmt"
	"github.com/dzfranklin/plantopo/backend/internal/phttp"
	"github.com/tidwall/geojson"
	"github.com/tidwall/gjson"
	"io"
	"log/slog"
	"net/url"
	"strconv"
)

type PhotonClient struct {
	l        *slog.Logger
	endpoint string
}

func newPhotonClient(l *slog.Logger) *PhotonClient {
	return &PhotonClient{l: l, endpoint: "https://photon.komoot.io/api/"}
}

func (c *PhotonClient) Query(ctx context.Context, query Query) ([]Result, error) {
	return queryPhoton(ctx, c.l, c.endpoint, query)
}

/*
	Available layers:

house
street
locality
district
city
county
state
country
other (e.g. natural features) - does not need to be specified
*/
var photonLayersToSearch = []string{"street", "locality", "district", "city", "county"}

var photonLocationBiasScale = 0.2

var photonResultLimit = 5

func queryPhoton(ctx context.Context, l *slog.Logger, endpoint string, query Query) ([]Result, error) {
	params := url.Values{}

	params.Set("q", query.Text)

	if query.Bias != nil {
		params.Set("lon", strconv.FormatFloat(query.Bias.Center.X, 'f', 6, 64))
		params.Set("lat", strconv.FormatFloat(query.Bias.Center.Y, 'f', 6, 64))
		params.Set("zoom", strconv.Itoa(query.Bias.Zoom))
		params.Set("location_bias_scale", strconv.FormatFloat(photonLocationBiasScale, 'f', -1, 64))
	}

	for _, layer := range photonLayersToSearch {
		params.Add("layer", layer)
	}

	params.Set("limit", strconv.Itoa(photonResultLimit))
	params.Set("lang", "en")

	l.Info("querying photon", "params", params.Encode())

	resp, err := phttp.Get(ctx, endpoint+"?"+params.Encode())
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	respBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	gj, err := geojson.Parse(string(respBytes), nil)
	if err != nil {
		return nil, err
	}

	fc, isFC := gj.(*geojson.FeatureCollection)
	if !isFC {
		return nil, fmt.Errorf("invalid JSON response")
	}

	var out []Result
	seen := make(map[string]struct{})
	for i, feature := range fc.Children() {
		f, isF := feature.(*geojson.Feature)
		if !isF {
			return nil, fmt.Errorf("invalid JSON response")
		}

		props := gjson.Get(feature.JSON(), "properties")

		id := "osm:" + props.Get("osm_type").String() + props.Get("osm_id").String()
		if _, ok := seen[id]; ok {
			// photon sometimes returns multiple slightly different results based on the same OSM relation (e.g. "London" on Sep 2024)
			continue
		}
		seen[id] = struct{}{}

		// The type field might be usable to approximate result quality
		// https://github.com/komoot/photon/issues/392
		// <https://github.com/komoot/photon/pull/473/commits/e8ab9448978fe313a97746197941fa43e3441fbd#diff-3d4b38d766d3dafcb9750911639269f2451567a2eb592129e6c64bfe217b73e5R123>

		r := Result{
			ID:           id,
			Name:         props.Get("name").String(),
			CountryCode2: props.Get("countrycode").String(),
			Geometry:     f.Base(),
			Debug: map[string]any{
				"provider":   "photon",
				"photon":     json.RawMessage(props.Raw),
				"photonRank": i,
			},
		}

		switch props.Get("type").String() {
		case "street":
			r.Type = StreetType
		case "city":
		case "district":
			r.Type = PopulatedPlaceType
		}

		osmKey := props.Get("osm_key").String()
		osmValue := props.Get("osm_value").String()
		if r.Type == "" {
			if osmKey == "landuse" && osmValue == "residential" {
				r.Type = PopulatedPlaceType
			} else if osmKey == "natural" && osmValue == "water" {
				r.Type = WaterBodyType
			} else if osmKey == "natural" && osmValue == "peak" {
				r.Type = HillType
			} else if osmKey == "place" && osmValue == "city" {
				r.Type = PopulatedPlaceType
			}
		}

		out = append(out, r)
	}
	return out, nil
}

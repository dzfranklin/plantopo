package psearch

import (
	"context"
	"fmt"
	"github.com/dzfranklin/plantopo/backend/internal/pslices"
	"github.com/dzfranklin/plantopo/backend/internal/ptest"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/tidwall/geojson"
	"github.com/tidwall/geojson/geometry"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestSearchPhotonUnmarshalling(t *testing.T) {
	cases := []struct {
		name     string
		json     string
		expected []Result
	}{
		{
			name: "city",
			json: `[{
			  "properties": {
				"name": "Berlin",
				"state": "Berlin",
				"country": "Germany",
				"countrycode": "DE",
				"osm_key": "place",
				"osm_value": "city",
				"osm_type": "N",
				"osm_id": 240109189
			  },
			  "type": "Feature",
			  "geometry": {
				"type": "Point",
				"coordinates": [13.3888599, 52.5170365]
			  }
			}]`,
			expected: []Result{{
				ID:           "osm:N240109189",
				Type:         PopulatedPlaceType,
				Name:         "Berlin",
				CountryCode2: "DE",
				Geometry:     geojson.NewPoint(geometry.Point{X: 13.3888599, Y: 52.5170365}),
			}},
		},
		{
			name: "attraction",
			json: `[{
			  "properties": {
				"name": "Berlin Olympic Stadium",
				"street": "Olympischer Platz",
				"housenumber": "3",
				"postcode": "14053",
				"state": "Berlin",
				"country": "Germany",
				"countrycode": "DE",
				"osm_key": "leisure",
				"osm_value": "stadium",
				"osm_type": "W",
				"osm_id": 38862723,
				"extent": [13.23727, 52.5157151, 13.241757, 52.5135972]
			  },
			  "type": "Feature",
			  "geometry": {
				"type": "Point",
				"coordinates": [13.239514674078611, 52.51467945]
			  }
			}]`,
			expected: []Result{{
				ID:           "osm:W38862723",
				Name:         "Berlin Olympic Stadium",
				CountryCode2: "DE",
				Geometry:     geojson.NewPoint(geometry.Point{X: 13.239514674078611, Y: 52.51467945}),
			}},
		},
		{
			name: "road",
			json: `[{
			  "geometry": {
				"coordinates": [-4.3870066, 55.8312045],
				"type": "Point"
			  },
			  "type": "Feature",
			  "properties": {
				"osm_id": 4602132,
				"extent": [-4.3889794, 55.8313407, -4.384871, 55.8310077],
				"country": "United Kingdom",
				"city": "Paisley",
				"countrycode": "GB",
				"postcode": "PA2 7NN",
				"locality": "Hawkhead Estate",
				"county": "Renfrewshire",
				"type": "street",
				"osm_type": "W",
				"osm_key": "highway",
				"district": "Hawkhead",
				"osm_value": "residential",
				"name": "Ben Alder Drive",
				"state": "Scotland"
			  }
			}]`,
			expected: []Result{{
				ID:           "osm:W4602132",
				Type:         StreetType,
				Name:         "Ben Alder Drive",
				CountryCode2: "GB",
				Geometry:     geojson.NewPoint(geometry.Point{X: -4.3870066, Y: 55.8312045}),
			}},
		},
		{
			name: "peak",
			json: `[{
			  "geometry": {
				"coordinates": [-4.4650482, 56.8138162],
				"type": "Point"
			  },
			  "type": "Feature",
			  "properties": {
				"osm_type": "N",
				"osm_id": 255421241,
				"country": "United Kingdom",
				"osm_key": "natural",
				"countrycode": "GB",
				"osm_value": "peak",
				"name": "Ben Alder",
				"type": "locality"
			  }
			}]`,
			expected: []Result{{
				ID:           "osm:N255421241",
				Type:         HillType,
				Name:         "Ben Alder",
				CountryCode2: "GB",
				Geometry:     geojson.NewPoint(geometry.Point{X: -4.4650482, Y: 56.8138162}),
			}},
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			l := ptest.NewTestLogger(t)
			srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				fmt.Fprintf(w, `{"type": "FeatureCollection", "features": %s}`, tc.json)
			}))
			defer srv.Close()
			got, err := queryPhoton(context.Background(), l, srv.URL, Query{Text: "arbitrary"})
			require.NoError(t, err)
			got = pslices.Map(got, func(t Result) Result {
				t.Debug = nil
				return t
			})
			assert.Equal(t, tc.expected, got)
		})
	}
}

func TestSmokeQueryPhoton(t *testing.T) {
	t.Skip()
	ctx := context.Background()
	l := ptest.NewTestLogger(t)
	endpoint := "https://photon.komoot.io/api/"
	query := Query{
		Text: "ben ald",
		Bias: &Bias{Center: geometry.Point{X: 57, Y: -4}, Zoom: 5},
	}
	got, err := queryPhoton(ctx, l, endpoint, query)
	require.NoError(t, err)
	fmt.Println(got)
}

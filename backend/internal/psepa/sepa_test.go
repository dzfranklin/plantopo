package psepa

import (
	"bytes"
	"context"
	"github.com/dzfranklin/plantopo/backend/internal/phttp"
	"github.com/stretchr/testify/require"
	"github.com/tidwall/geojson/geometry"
	"io"
	"net/http"
	"testing"
)

var sampleStationsCSV = []byte(`station_id;station_name;catchment_id;catchment_name;station_latitude;station_longitude;parametertype_id;parametertype_name;parametertype_longname
36870;Abbey St Bathans;277179;Tweed;55.85329633;'-2.387448356;560;S;River Stage
36870;Abbey St Bathans;277179;Tweed;55.85329633;'-2.387448356;523;Precip;Precipitation
36870;Abbey St Bathans;277179;Tweed;55.85329633;'-2.387448356;558;Q;River Discharge
37132;Aberlour;277150;Spey;57.48021805;'-3.205975095;560;S;River Stage
37132;Aberlour;277150;Spey;57.48021805;'-3.205975095;523;Precip;Precipitation`)

func TestUpdate(t *testing.T) {
	c := &http.Client{
		Transport: phttp.RoundTripper(func(_req *http.Request) (*http.Response, error) {
			return &http.Response{
				StatusCode: http.StatusOK,
				Body:       io.NopCloser(bytes.NewBuffer(sampleStationsCSV)),
			}, nil
		}),
	}

	want := []Station{
		{
			ID:            "36870",
			Name:          "Abbey St Bathans",
			Point:         geometry.Point{-2.387448356, 55.85329633},
			CatchmentID:   "277179",
			CatchmentName: "Tweed",
			Parameters: []ParameterName{
				{ID: "560", Name: "S", LongName: "River Stage"},
				{ID: "523", Name: "Precip", LongName: "Precipitation"},
				{ID: "558", Name: "Q", LongName: "River Discharge"},
			},
		},
		{
			ID:            "37132",
			Name:          "Aberlour",
			Point:         geometry.Point{-3.205975095, 57.48021805},
			CatchmentID:   "277150",
			CatchmentName: "Spey",
			Parameters: []ParameterName{
				{ID: "560", Name: "S", LongName: "River Stage"},
				{ID: "523", Name: "Precip", LongName: "Precipitation"},
			},
		},
	}

	got, err := update(context.Background(), c)
	require.NoError(t, err)
	require.Equal(t, want, got)
}

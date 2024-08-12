package ordnancesurvey

import (
	"context"
	"errors"
	"fmt"
	"github.com/twpayne/go-proj/v10"
	"net/url"
	"strconv"
	"strings"
)

type GazetteerEntry struct {
	ID                  string  // Example: "osgb4000000074604559"
	NamesURI            string  // Example: "http://data.ordnancesurvey.co.uk/id/4000000074604559"
	Name1               string  // Example: "Ben Nevis"
	Name1Lang           string  // Example: "eng"
	Name2               string  // Example: "Beinn Nibheis"
	Name2Lang           string  // Example: "gla"
	Type                string  // Example: "landform"
	LocalType           string  // Example: "Hill Or Mountain"
	Longitude           float64 // Example: -5.003683
	Latitude            float64 // Example: 56.796887
	PostcodeDistrict    string  // Example: "PH33"
	PostcodeDistrictURI string  // Example: "http://data.ordnancesurvey.co.uk/id/postcodedistrict/PH33"
	CountyUnitary       string  // Example: "Highland"
	CountyUnitaryURI    string  // Example: "http://data.ordnancesurvey.co.uk/id/7000000000186625"
	CountyUnitaryType   string  // Example: "http://data.ordnancesurvey.co.uk/ontology/admingeo/UnitaryAuthority"
	Region              string  // Example: "Scotland"
	RegionURI           string  // Example: "http://data.ordnancesurvey.co.uk/id/7000000000041429"
	Country             string  // Example: "Scotland"
	CountryURI          string  // Example: "http://data.ordnancesurvey.co.uk/id/country/scotland"
}

type gazetteerEntry struct {
	ID                  string  `json:"ID"`                    // Example: "osgb4000000074604559"
	NamesURI            string  `json:"NAMES_URI"`             // Example: "http://data.ordnancesurvey.co.uk/id/4000000074604559"
	Name1               string  `json:"NAME1"`                 // Example: "Ben Nevis"
	Name1Lang           string  `json:"NAME1_LANG"`            // Example: "eng"
	Name2               string  `json:"NAME2"`                 // Example: "Beinn Nibheis"
	Name2Lang           string  `json:"NAME2_LANG"`            // Example: "gla"
	Type                string  `json:"TYPE"`                  // Example: "landform"
	LocalType           string  `json:"LOCAL_TYPE"`            // Example: "Hill Or Mountain"
	GeometryX           float64 `json:"GEOMETRY_X"`            // Example: 216666
	GeometryY           float64 `json:"GEOMETRY_Y"`            // Example: 771288
	MostDetailViewRes   float64 `json:"MOST_DETAIL_VIEW_RES"`  // Example: 1000
	LeastDetailViewRes  float64 `json:"LEAST_DETAIL_VIEW_RES"` // Example: 300000
	MBRXMIN             float64 `json:"MBR_XMIN"`              // Example: 216442
	MBRYMIN             float64 `json:"MBR_YMIN"`              // Example: 771024
	MBRXMAX             float64 `json:"MBR_XMAX"`              // Example: 216942
	MBRYMAX             float64 `json:"MBR_YMAX"`              //Example: 771524
	PostcodeDistrict    string  `json:"POSTCODE_DISTRICT"`     // Example: "PH33"
	PostcodeDistrictURI string  `json:"POSTCODE_DISTRICT_URI"` // Example: "http://data.ordnancesurvey.co.uk/id/postcodedistrict/PH33"
	CountyUnitary       string  `json:"COUNTY_UNITARY"`        // Example: "Highland"
	CountyUnitaryURI    string  `json:"COUNTY_UNITARY_URI"`    // Example: "http://data.ordnancesurvey.co.uk/id/7000000000186625"
	CountyUnitaryType   string  `json:"COUNTY_UNITARY_TYPE"`   // Example: "http://data.ordnancesurvey.co.uk/ontology/admingeo/UnitaryAuthority"
	Region              string  `json:"REGION"`                // Example: "Scotland"
	RegionURI           string  `json:"REGION_URI"`            // Example: "http://data.ordnancesurvey.co.uk/id/7000000000041429"
	Country             string  `json:"COUNTRY"`               // Example: "Scotland"
	CountryURI          string  `json:"COUNTRY_URI"`           // Example: "http://data.ordnancesurvey.co.uk/id/country/scotland"
}

type nameSearchResults struct {
	Results []struct {
		GazetteerEntry gazetteerEntry `json:"GAZETTEER_ENTRY"`
	} `json:"results"`
}

type FindNamesOptions struct {
	MaxResults int      // Between 1 and 100, or 0 for default
	LocalTypes []string // Filter the results by local type. See <https://osdatahub.os.uk/docs/names/technicalSpecification>
	// Currently unsupported: point, radius, bbox
}

func (c *Client) FindNames(ctx context.Context, query string, opts *FindNamesOptions) ([]GazetteerEntry, error) {
	// Options

	if opts == nil {
		opts = &FindNamesOptions{}
	}
	if opts.MaxResults == 0 {
		opts.MaxResults = 100
	}

	// Set up params

	params := make(url.Values)

	params.Add("maxResults", strconv.Itoa(opts.MaxResults))
	params.Add("query", query)

	var fq strings.Builder
	for _, ty := range opts.LocalTypes {
		if strings.Contains(ty, " ") {
			return nil, errors.New("invalid local type")
		}
		fmt.Fprintf(&fq, "LOCAL_TYPE:%s ", ty)
	}
	params.Add("fq", fq.String())

	// Perform search

	var results nameSearchResults
	err := c.c.Get(ctx, &results, "search/names/v1/find?"+params.Encode())
	if err != nil {
		return nil, err
	}

	// Prepare results

	pj := newFromBNG()

	var out []GazetteerEntry
	for _, result := range results.Results {
		raw := result.GazetteerEntry

		projected, err := pj.Forward(proj.NewCoord(raw.GeometryX, raw.GeometryY, 0, 0))
		if err != nil {
			return nil, err
		}

		out = append(out, GazetteerEntry{
			ID:                  raw.ID,
			NamesURI:            raw.NamesURI,
			Name1:               raw.Name1,
			Name1Lang:           raw.Name1Lang,
			Name2:               raw.Name2,
			Name2Lang:           raw.Name2Lang,
			Type:                raw.Type,
			LocalType:           raw.LocalType,
			Longitude:           projected.Y(),
			Latitude:            projected.X(),
			PostcodeDistrict:    raw.PostcodeDistrict,
			PostcodeDistrictURI: raw.PostcodeDistrictURI,
			CountyUnitary:       raw.CountyUnitary,
			CountyUnitaryURI:    raw.CountyUnitaryURI,
			CountyUnitaryType:   raw.CountyUnitaryType,
			Region:              raw.Region,
			RegionURI:           raw.RegionURI,
			Country:             raw.Country,
			CountryURI:          raw.CountryURI,
		})
	}
	return out, nil
}

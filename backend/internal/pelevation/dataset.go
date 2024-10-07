package pelevation

import (
	"context"
	"encoding/xml"
	"errors"
	"fmt"
	"github.com/airbusgeo/godal"
	"github.com/tidwall/geojson/geometry"
	"log/slog"
	"math"
)

type dataset struct {
	*godal.Dataset
	l             *slog.Logger
	name          string
	structure     godal.DatasetStructure
	trans         [6]float64
	invTrans      [6]float64
	band          godal.Band
	bandStructure godal.BandStructure
	hasNodata     bool
	nodata        float64
}

/* Notes on concurrency:

GDAL uses global caches protected by mutexes. Opening multiple copies of the same dataset will use those to some extent
but also per the documentation can lead to excessive memory usage.

I suspect we will be limited by the http requests to get data most of the time. That makes me think serializing lookups
to maximize cache sharing will work better than multiple parallel datasets. Plus it's simpler anyway.

See:

- https://gdal.org/en/latest/user/multithreading.html#ram-fragmentation-and-multi-threading
- https://gdal-dev.osgeo.narkive.com/3r7CQ8Ol/rfc-47-and-threading
- https://web.archive.org/web/20240126143225/http://erouault.blogspot.com/2015/07/reliable-multithreading-is-hard.html
*/

const cacheGB = 5

func openDataset(l *slog.Logger, name string) (*dataset, error) {
	ds, openErr := godal.Open(name,
		godal.ConfigOption("GDAL_DISABLE_READDIR_ON_OPEN=EMPTY_DIR"),
		godal.ConfigOption("GDAL_HTTP_MAX_RETRY=3"),
		godal.ConfigOption("GDAL_HTTP_RETRY_DELAY=1"), // in seconds
		godal.ConfigOption("GDAL_HTTP_RETRY_CODES=ALL"),
		godal.ConfigOption(fmt.Sprintf("CPL_VSIL_CURL_CACHE_SIZE=%d", cacheGB*1_000_000_000)),
	)
	if openErr != nil {
		return nil, openErr
	}

	structure := ds.Structure()

	trans, transErr := ds.GeoTransform()
	if transErr != nil {
		return nil, transErr
	}

	invTrans := invGeoTransform(trans)

	bands := ds.Bands()
	if len(bands) != 1 {
		return nil, errors.New("expected one band")
	}
	band := bands[0]

	bandStructure := band.Structure()

	nodata, hasNodata := band.NoData()

	return &dataset{
		Dataset:       ds,
		l:             l.With("app", "pelevation"),
		name:          name,
		structure:     structure,
		trans:         trans,
		invTrans:      invTrans,
		band:          band,
		bandStructure: bandStructure,
		nodata:        nodata,
		hasNodata:     hasNodata,
	}, nil
}

func (ds *dataset) lookup(ctx context.Context, points []geometry.Point) ([]int16, error) {
	// Note: This could possibly be optimized to use AdviseRead
	out := make([]int16, len(points))
	for i := range out {
		if ctx.Err() != nil {
			return nil, ctx.Err()
		}

		var err error
		out[i], err = ds.lookupOne(points[i])
		if err != nil {
			return nil, err
		}
	}
	return out, nil
}

func (ds *dataset) lookupOne(point geometry.Point) (int16, error) {
	pixelToQuery, lineToQuery, insideBounds := ds.lookupLocation(point)
	if !insideBounds {
		return 0, nil
	}

	out := make([]int16, 1)
	readErr := ds.band.Read(pixelToQuery, lineToQuery, out, 1, 1)
	if readErr != nil {
		return 0, readErr
	}
	v := out[0]

	if ds.hasNodata && int16(ds.nodata) == v {
		v = 0
	}

	return v, nil
}

// locationInfo returns the file(s) that provide location for the point
func (ds *dataset) locationInfo(point geometry.Point) ([]string, error) {
	pixelToQuery, lineToQuery, insideBounds := ds.lookupLocation(point)
	if !insideBounds {
		return nil, nil
	}
	metaKey := fmt.Sprintf("Pixel_%d_%d", pixelToQuery, lineToQuery)
	meta := ds.band.Metadata(metaKey, godal.Domain("LocationInfo"))
	return parseLocationInfo(meta)
}

func parseLocationInfo(v string) ([]string, error) {
	var locationInfo struct {
		File []string `xml:"File"`
	}
	if err := xml.Unmarshal([]byte(v), &locationInfo); err != nil {
		return nil, err
	}
	return locationInfo.File, nil
}

func (ds *dataset) lookupLocation(point geometry.Point) (int, int, bool) {
	// Ported from gdallocationinfo

	pixel := int(math.Floor(ds.invTrans[0] + ds.invTrans[1]*point.X + ds.invTrans[2]*point.Y))
	line := int(math.Floor(ds.invTrans[3] + ds.invTrans[4]*point.X + ds.invTrans[5]*point.Y))
	if pixel < 0 || line < 0 || pixel >= ds.structure.SizeX || line >= ds.structure.SizeY {
		return 0, 0, false
	}

	pixelToQuery := int(0.5 + 1.0*float64(pixel)/float64(ds.structure.SizeX)*float64(ds.bandStructure.SizeX))
	lineToQuery := int(0.5 + 1.0*float64(line)/float64(ds.structure.SizeY)*float64(ds.bandStructure.SizeY))
	if pixelToQuery >= ds.bandStructure.SizeX {
		pixelToQuery = ds.bandStructure.SizeX - 1
	}
	if lineToQuery >= ds.bandStructure.SizeY {
		lineToQuery = ds.bandStructure.SizeX - 1
	}

	return pixelToQuery, lineToQuery, true
}

/*
invGeoTransform inverts a Geotransform.

This function will invert a standard 3x2 set of GeoTransform coefficients.
This converts the equation from being pixel to geo to being geo to pixel.

- gt_in: Input geotransform (six doubles - unaltered)

- gt_out: Output geotransform (six doubles - updated)

Panics if the equation is uninvertable.
*/
func invGeoTransform(input [6]float64) [6]float64 {
	// Ported from GDALInvGeoTransform

	out := [6]float64{}

	// Special case - no rotation - to avoid computing determinate
	// and potential precision issues.
	if input[2] == 0.0 && input[4] == 0.0 && input[1] != 0.0 &&
		input[5] != 0.0 {
		/*X = input[0] + x * input[1]
		  Y = input[3] + y * input[5]
		  -->
		  x = -input[0] / input[1] + (1 / input[1]) * X
		  y = -input[3] / input[5] + (1 / input[5]) * Y
		*/
		out[0] = -input[0] / input[1]
		out[1] = 1.0 / input[1]
		out[2] = 0.0
		out[3] = -input[3] / input[5]
		out[4] = 0.0
		out[5] = 1.0 / input[5]
		return out
	}

	// Assume a 3rd row that is [1 0 0].

	// Compute determinate.

	det := input[1]*input[5] - input[2]*input[4]
	magnitude := max(max(math.Abs(input[1]), math.Abs(input[2])),
		max(math.Abs(input[4]), math.Abs(input[5])))

	if math.Abs(det) <= 1e-10*magnitude*magnitude {
		panic("equation is uninvertable")
	}

	invDet := 1.0 / det

	// Compute adjoint, and divide by determinate.

	out[1] = input[5] * invDet
	out[4] = -input[4] * invDet

	out[2] = -input[2] * invDet
	out[5] = input[1] * invDet

	out[0] = (input[2]*input[3] - input[0]*input[5]) * invDet
	out[3] = (-input[1]*input[3] + input[0]*input[4]) * invDet

	return out
}

package ordnancesurvey

import (
	"archive/zip"
	"context"
	"encoding/csv"
	"errors"
	"fmt"
	"github.com/dzfranklin/plantopo/backend/internal/pgeo"
	"github.com/dzfranklin/plantopo/backend/internal/phttp"
	"github.com/dzfranklin/plantopo/backend/internal/pslices"
	"github.com/tidwall/geojson/geometry"
	"github.com/twpayne/go-proj/v10"
	"io"
	"os"
	"slices"
	"strconv"
	"strings"
)

type PostcodePoint struct {
	Code  string
	Point geometry.Point
}

func ParseLatestCodePointOpen(ctx context.Context, onPoint func(point PostcodePoint) error) error {
	resp, getErr := phttp.Get(ctx, "https://api.os.uk/downloads/v1/products/CodePointOpen/downloads?area=GB&format=CSV&redirect")
	if getErr != nil {
		return getErr
	}
	defer resp.Body.Close()

	tempF, createTempErr := os.CreateTemp("", "code_point_open_")
	if createTempErr != nil {
		return createTempErr
	}
	defer func() {
		tempF.Close()
		_ = os.Remove(tempF.Name())
	}()

	_, copyErr := io.Copy(tempF, resp.Body)
	if copyErr != nil {
		return copyErr
	}

	zr, openZipErr := zip.OpenReader(tempF.Name())
	if openZipErr != nil {
		return openZipErr
	}

	return ParseCodePointOpenZip(ctx, &zr.Reader, onPoint)
}

func ParseCodePointOpenZip(ctx context.Context, zr *zip.Reader, onPoint func(point PostcodePoint) error) error {
	// Parse header file to get indices for the fields we are interested in

	hEntry := pslices.First(zr.File, func(file *zip.File) bool {
		return file.Name == "Doc/Code-Point_Open_Column_Headers.csv"
	})
	if hEntry == nil {
		return errors.New("missing headers file")
	}
	hf, hOpenErr := hEntry.Open()
	if hOpenErr != nil {
		return hOpenErr
	}
	defer hf.Close()
	hr := csv.NewReader(hf)
	header, headerErr := hr.Read()
	if headerErr != nil {
		return headerErr
	}

	postcodeI := slices.Index(header, "PC")
	if postcodeI < 0 {
		return errors.New("missing PC header")
	}
	eastingI := slices.Index(header, "EA")
	if eastingI < 0 {
		return errors.New("missing EA header")
	}
	northingI := slices.Index(header, "NO")
	if northingI < 0 {
		return errors.New("missing NO header")
	}

	// Parse files

	for _, entry := range zr.File {
		if err := ctx.Err(); err != nil {
			return err
		}

		if !strings.HasPrefix(entry.Name, "Data/CSV/") ||
			!strings.HasSuffix(entry.Name, ".csv") ||
			!entry.Mode().IsRegular() {
			continue
		}

		f, openErr := entry.Open()
		if openErr != nil {
			return openErr
		}
		if err := parseCodePointOpenCSV(f, onPoint, postcodeI, eastingI, northingI); err != nil {
			f.Close()
			return err
		}
		f.Close()
	}

	return nil
}

func parseCodePointOpenCSV(
	f io.Reader, onPoint func(point PostcodePoint) error,
	postcodeI int, eastingI int, northingI int,
) error {
	pj := newFromBNG()
	r := csv.NewReader(f)
	minRowSize := max(postcodeI, eastingI, northingI) + 1
	for {
		row, readErr := r.Read()
		if readErr == io.EOF {
			break
		} else if readErr != nil {
			return readErr
		}

		if len(row) < minRowSize {
			return fmt.Errorf("invalid row (too short): %v", row)
		}

		postcode := row[postcodeI]
		eastingS := row[eastingI]
		northingS := row[northingI]

		easting, eastingErr := strconv.ParseFloat(eastingS, 64)
		if eastingErr != nil {
			return eastingErr
		}
		northing, northingErr := strconv.ParseFloat(northingS, 64)
		if northingErr != nil {
			return northingErr
		}

		lnglat, projErr := pj.Forward(proj.NewCoord(easting, northing, 0, 0))
		if projErr != nil {
			return projErr
		}

		point := pgeo.RoundPoint(geometry.Point{X: lnglat.Y(), Y: lnglat.X()}) // epsg:4326 is lat,lng
		out := PostcodePoint{Code: postcode, Point: point}

		if err := onPoint(out); err != nil {
			return err
		}
	}
	return nil
}

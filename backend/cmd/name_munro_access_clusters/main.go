package main

import (
	"compress/gzip"
	"context"
	"github.com/dzfranklin/plantopo/backend/internal/pcsv"
	"github.com/dzfranklin/plantopo/backend/internal/phttp"
	"github.com/tidwall/gjson"
	"github.com/tidwall/rtree"
	"github.com/tidwall/sjson"
	"github.com/twpayne/go-proj/v10"
	"math"
	"os"
	"slices"
	"strconv"
)

func main() {
	namesPath := os.Getenv("NAMES_PATH")
	if namesPath == "" {
		namesPath = "https://minio.dfranklin.dev/geodata/gb_opennames.csv.gz"
	}

	startsPath := os.Args[1]
	if startsPath == "" {
		panic("expected startsPath")
	}

	outPath := os.Args[2]
	if outPath == "" {
		panic("expected outPath")
	}

	startsJSONBytes, err := os.ReadFile(startsPath)
	if err != nil {
		panic(err)
	}
	startsJSON := string(startsJSONBytes)

	namesF, err := phttp.OpenRemoteOrLocal(context.Background(), namesPath)
	if err != nil {
		panic(err)
	}
	defer func() { _ = namesF.Close() }()
	namesGZ, err := gzip.NewReader(namesF)
	if err != nil {
		panic(err)
	}
	namesCSV := pcsv.NewMapReader(namesGZ)

	pj, err := proj.NewCRSToCRS("EPSG:27700", "EPSG:4326", nil)
	if err != nil {
		panic(err)
	}

	names := rtree.RTreeG[map[string]string]{}
	for namesCSV.Next() {
		record := namesCSV.Value()

		if !slices.Contains([]string{"populatedPlace"}, record["TYPE"]) {
			continue
		}

		x, err := strconv.ParseInt(record["GEOMETRY_X"], 10, 64)
		if err != nil {
			panic(err)
		}
		y, err := strconv.ParseInt(record["GEOMETRY_Y"], 10, 64)
		if err != nil {
			panic(err)
		}

		projected, err := pj.Forward(proj.NewCoord(float64(x), float64(y), 0, 0))
		if err != nil {
			panic(err)
		}

		point := [2]float64{projected[1], projected[0]}
		names.Insert(point, point, record)
	}
	if err := namesCSV.Error(); err != nil {
		panic(err)
	}

	for i, feature := range gjson.Get(startsJSON, "features").Array() {
		lng := feature.Get("geometry.coordinates.0").Float()
		lat := feature.Get("geometry.coordinates.1").Float()
		featurePoint := [2]float64{lng, lat}

		var closest map[string]string
		var closestPoint [2]float64
		names.Nearby(rtree.BoxDist[float64, map[string]string](featurePoint, featurePoint, nil), func(point, _ [2]float64, data map[string]string, _ float64) bool {
			closest = data
			closestPoint = point
			return false
		})

		name := closest["NAME1"]

		dist := haversineDistanceMeters(featurePoint, closestPoint)
		if dist > 1000 {
			name = "near " + name
		}

		var err error
		startsJSON, err = sjson.Set(startsJSON, "features."+strconv.Itoa(i)+".properties.clusterName", name)
		if err != nil {
			panic(err)
		}
	}

	if err := os.WriteFile(outPath, []byte(startsJSON), 0600); err != nil {
		panic(err)
	}
}

func haversineDistanceMeters(p, q [2]float64) int {
	lng1 := degreesToRadians(p[0])
	lat1 := degreesToRadians(p[1])
	lng2 := degreesToRadians(q[0])
	lat2 := degreesToRadians(q[1])

	diffLat := lat2 - lat1
	diffLon := lng2 - lng1

	a := math.Pow(math.Sin(diffLat/2), 2) + math.Cos(lat1)*math.Cos(lat2)*
		math.Pow(math.Sin(diffLon/2), 2)

	c := 2 * math.Atan2(math.Sqrt(a), math.Sqrt(1-a))

	return int(math.Round(c * 6371e3))
}

func degreesToRadians(d float64) float64 {
	return d * math.Pi / 180
}

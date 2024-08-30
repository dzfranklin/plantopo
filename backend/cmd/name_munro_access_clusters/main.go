package main

import (
	"fmt"
	"github.com/dzfranklin/plantopo/backend/internal/pconfig"
	"github.com/dzfranklin/plantopo/backend/internal/pgeocoding"
	"github.com/mmcloughlin/geohash"
	"github.com/tidwall/gjson"
	"github.com/tidwall/sjson"
	"os"
	"strconv"
)

func main() {
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

	cfg := pconfig.Read()
	geocoder := pgeocoding.New(cfg)

	cache := make(map[string]string)
	for i, feature := range gjson.Get(startsJSON, "features").Array() {
		lng := feature.Get("geometry.coordinates.0").Float()
		lat := feature.Get("geometry.coordinates.1").Float()

		var name string
		hash := geohash.Encode(lat, lng)
		if v, ok := cache[hash]; ok {
			name = v
		} else {
			var err error
			name, err = geocoder.PlaceName(lng, lat, nil)
			if err != nil {
				panic(err)
			}
			cache[hash] = name
			fmt.Println(lng, lat, name)
		}

		startsJSON, err = sjson.Set(startsJSON, "features."+strconv.Itoa(i)+".properties.clusterName", name)
		if err != nil {
			panic(err)
		}
	}

	if err := os.WriteFile(outPath, []byte(startsJSON), 0600); err != nil {
		panic(err)
	}
}

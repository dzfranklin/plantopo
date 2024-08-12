package pmunroaccess

import (
	_ "embed"
	"encoding/json"
)

//go:embed munro_starts.json
var munroStartsGeoJSON []byte

var munroStartClusters []*munroStartCluster

type munroStartCluster struct {
	Munros      []string       `json:"munros"`
	PopularityA map[string]int `json:"popularityA"`
	PopularityB map[string]int `json:"popularityB"`
	Point       [2]float64     `json:"point"`
}

func init() {
	var munroStartsGeoJSONData struct {
		Features []struct {
			Properties struct {
				Munro       string
				Cluster     int
				PopularityA int
				PopularityB int
			}
			Geometry struct {
				Coordinates [3]float64
			}
		}
	}
	err := json.Unmarshal(munroStartsGeoJSON, &munroStartsGeoJSONData)
	if err != nil {
		panic("invalid munro_starts.json")
	}

	byCluster := make(map[int]*munroStartCluster)
	for _, f := range munroStartsGeoJSONData.Features {
		props := f.Properties

		cluster, ok := byCluster[props.Cluster]
		if !ok {
			cluster = &munroStartCluster{
				Point:       [2]float64{f.Geometry.Coordinates[0], f.Geometry.Coordinates[1]},
				PopularityA: make(map[string]int),
				PopularityB: make(map[string]int),
			}
			byCluster[props.Cluster] = cluster
		}

		cluster.Munros = append(cluster.Munros, props.Munro)
		cluster.PopularityA[props.Munro] = props.PopularityA
		cluster.PopularityB[props.Munro] = props.PopularityB
	}
	for _, cluster := range byCluster {
		munroStartClusters = append(munroStartClusters, cluster)
	}
}

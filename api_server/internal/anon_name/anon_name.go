package anon_name

import (
	_ "embed"
	"encoding/json"
	"fmt"
	"hash/fnv"
	"os"
)

var apiDomain string

func init() {
	apiDomain = os.Getenv("API_DOMAIN")
	if apiDomain == "" {
		apiDomain = "plantopo.com"
	}
}

//go:embed animals.json
var animalsJSON []byte
var animals = mustUnmarshalStrings(animalsJSON)

//go:embed colors.json
var colorsJSON []byte
var colors = mustUnmarshalStrings(colorsJSON)

func mustUnmarshalStrings(data []byte) []string {
	var animals []string
	err := json.Unmarshal(data, &animals)
	if err != nil {
		panic(err)
	}
	return animals
}

func For(id string) string {
	bytes := []byte(id)
	hasher := fnv.New32()
	for _, b := range bytes {
		if _, err := hasher.Write([]byte{b}); err != nil {
			panic(err)
		}
	}
	hash := int(hasher.Sum32())

	i := hash % (len(animals) * len(colors))
	animalI := i / len(colors)
	colorI := i % len(colors)

	return fmt.Sprintf("Anonymous %s %s", colors[colorI], animals[animalI])
}

func AvatarURL(id string) string {
	return fmt.Sprintf("https://%s/api/v1/anon-avatar/%s.png", apiDomain, id)
}

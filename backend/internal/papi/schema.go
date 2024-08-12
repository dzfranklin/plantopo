package papi

import (
	_ "embed"
	"log"
	"sigs.k8s.io/yaml"
)

//go:embed schema.gen.yaml
var schemaYAML string

var SchemaJSON string

func init() {
	converted, err := yaml.YAMLToJSON([]byte(schemaYAML))
	if err != nil {
		log.Fatal(err)
	}
	SchemaJSON = string(converted)
}

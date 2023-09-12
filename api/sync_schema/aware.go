package sync_schema

import "github.com/google/uuid"

type Aware struct {
	ClientId         uuid.UUID `json:"clientId"` // changes every session
	Name             string    `json:"name"`
	Camera           *Camera   `json:"camera,omitempty"`
	SelectedFeatures *[]string `json:"selectedFeatures,omitempty"`
}

type Camera struct {
	Lng     float64 `json:"lng"`
	Lat     float64 `json:"lat"`
	Zoom    float64 `json:"zoom"`
	Bearing float64 `json:"bearing"`
	Pitch   float64 `json:"pitch"`
}

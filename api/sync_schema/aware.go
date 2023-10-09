package sync_schema

import "github.com/google/uuid"

type Aware struct {
	Trusted          TrustedAware `json:"trusted"`
	Camera           *Camera      `json:"camera,omitempty"`
	SelectedFeatures *[]string    `json:"selectedFeatures,omitempty"`
}

type TrustedAware struct {
	ClientId string     `json:"clientId"` // changes every session
	UserId   *uuid.UUID `json:"userId"`   // nil for anonymous
	Name     string     `json:"name"`
}

type Camera struct {
	Lng     float64 `json:"lng"`
	Lat     float64 `json:"lat"`
	Zoom    float64 `json:"zoom"`
	Bearing float64 `json:"bearing"`
	Pitch   float64 `json:"pitch"`
}

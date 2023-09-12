package map_meta

import (
	"time"

	"github.com/google/uuid"
)

type Meta struct {
	Id        uuid.UUID `json:"id,omitempty"`
	Name      string    `json:"name,omitempty"`
	CreatedAt time.Time `json:"createdAt,omitempty"`
}

type MetaUpdate struct {
	Id   uuid.UUID `json:"id,omitempty"`
	Name string    `json:"name,omitempty"`
}

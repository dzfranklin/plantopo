package maps

import (
	"github.com/google/uuid"
)

type MetaUpdateRequest struct {
	Id   uuid.UUID `json:"id,omitempty"`
	Name string    `json:"name,omitempty"`
}

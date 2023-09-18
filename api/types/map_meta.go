package types

import (
	"time"

	"github.com/google/uuid"
)

type MapMeta struct {
	Id        uuid.UUID `json:"id"`
	Name      string    `json:"name"`
	CreatedAt time.Time `json:"createdAt"`
}

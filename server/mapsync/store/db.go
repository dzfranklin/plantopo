package store

import (
	"context"

	"github.com/google/uuid"
)

type Db interface {
	GetMapSnapshot(ctx context.Context, mapId uuid.UUID) ([]byte, error)
	SetMapSnapshot(ctx context.Context, mapId uuid.UUID, value []byte) error
}

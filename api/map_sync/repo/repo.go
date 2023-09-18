package repo

import (
	"context"

	"github.com/danielzfranklin/plantopo/api/db"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"go.uber.org/zap"
)

type Repo interface {
	GetMapSnapshot(ctx context.Context, mapId uuid.UUID) ([]byte, error)
	SetMapSnapshot(ctx context.Context, mapId uuid.UUID, value []byte) error
}

type impl struct {
	l  *zap.SugaredLogger
	db *db.Pg
}

func New(l *zap.Logger, db *db.Pg) Repo {
	return &impl{l.Sugar(), db}
}

func (r *impl) GetMapSnapshot(ctx context.Context, mapId uuid.UUID) ([]byte, error) {
	var value []byte
	err := r.db.QueryRow(ctx,
		`SELECT value FROM map_snapshots WHERE map_id = $1`, mapId,
	).Scan(&value)
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, nil
		}
		r.l.DPanic(err)
		return nil, err
	}
	return value, nil
}

func (r *impl) SetMapSnapshot(ctx context.Context, mapId uuid.UUID, value []byte) error {
	_, err := r.db.Exec(ctx,
		`INSERT INTO map_snapshots (map_id, value)
			VALUES ($1, $2)
			ON CONFLICT (map_id) DO UPDATE SET value = $2`,
		mapId, value,
	)
	if err != nil {
		r.l.DPanic(err)
		return err
	}
	return nil
}

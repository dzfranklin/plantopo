package map_meta

import (
	"context"
	"errors"

	"github.com/danielzfranklin/plantopo/api/db"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"go.uber.org/zap"
)

type Service interface {
	Get(ctx context.Context, id uuid.UUID) (Meta, error)
	Create(ctx context.Context, owner uuid.UUID) (Meta, error)
	Patch(ctx context.Context, update MetaUpdate) (Meta, error)
	Delete(ctx context.Context, id uuid.UUID) error
	ListOwnedBy(ctx context.Context, userId uuid.UUID) ([]Meta, error)
	ListSharedWith(ctx context.Context, userId uuid.UUID) ([]Meta, error)
}

type ErrNotFound struct{}

func (e *ErrNotFound) Error() string {
	return "not found"
}

type impl struct {
	pg *db.Pg
	l  *zap.Logger
}

func NewService(ctx context.Context, pg *db.Pg) Service {
	l := zap.L().Named("mapmeta")
	s := &impl{
		pg: pg,
		l:  l,
	}
	return s
}

func (s *impl) Get(ctx context.Context, id uuid.UUID) (Meta, error) {
	if id == uuid.Nil {
		return Meta{}, errors.New("id is required")
	}
	var meta Meta
	err := s.pg.QueryRow(ctx,
		`SELECT id, name, created_at
			FROM maps
			WHERE id = $1 AND deleted_at IS NULL`,
		id,
	).Scan(&meta.Id, &meta.Name, &meta.CreatedAt)
	if err != nil {
		if err == pgx.ErrNoRows {
			return Meta{}, &ErrNotFound{}
		}
		return Meta{}, err
	}
	return meta, nil
}

func (s *impl) Create(ctx context.Context, owner uuid.UUID) (Meta, error) {
	tx, err := s.pg.Begin(ctx)
	if err != nil {
		s.l.DPanic("failed to begin transaction", zap.Error(err))
		return Meta{}, err
	}
	defer tx.Rollback(ctx)

	var meta Meta
	err = s.pg.QueryRow(ctx,
		`INSERT INTO maps DEFAULT VALUES RETURNING id, name, created_at`,
	).Scan(&meta.Id, &meta.Name, &meta.CreatedAt)
	if err != nil {
		return Meta{}, err
	}

	_, err = s.pg.Exec(ctx, `
		INSERT INTO map_roles (map_id, user_id, my_role)
			VALUES ($1, $2, 'owner')`,
		meta.Id, owner)
	if err != nil {
		return Meta{}, err
	}

	err = tx.Commit(ctx)
	if err != nil {
		return Meta{}, err
	}

	return meta, nil
}

func (s *impl) Patch(ctx context.Context, update MetaUpdate) (Meta, error) {
	if update.Id == uuid.Nil {
		return Meta{}, errors.New("id is required")
	}
	var meta Meta
	err := s.pg.QueryRow(ctx,
		`UPDATE maps
			SET name = $2
			WHERE id = $1 AND deleted_at IS NULL
			RETURNING id, name, created_at`,
		update.Id, update.Name,
	).Scan(&meta.Id, &meta.Name, &meta.CreatedAt)
	if err != nil {
		if err == pgx.ErrNoRows {
			return Meta{}, &ErrNotFound{}
		}
		return Meta{}, err
	}
	return meta, nil
}

func (s *impl) Delete(ctx context.Context, id uuid.UUID) error {
	if id == uuid.Nil {
		return errors.New("id is required")
	}

	tx, err := s.pg.Begin(ctx)
	if err != nil {
		s.l.DPanic("failed to begin transaction", zap.Error(err))
		return err
	}
	defer tx.Rollback(ctx)

	rows, err := s.pg.Query(ctx,
		`UPDATE maps SET deleted_at = NOW() WHERE id = $1 RETURNING id`,
		id,
	)
	if err != nil {
		return err
	}
	defer rows.Close()
	if !rows.Next() {
		return &ErrNotFound{}
	}

	_, err = s.pg.Exec(ctx,
		`DELETE FROM map_roles WHERE map_id = $1`,
		id,
	)
	if err != nil {
		return err
	}

	err = tx.Commit(ctx)
	if err != nil {
		return err
	}

	return nil
}

func (s *impl) ListOwnedBy(ctx context.Context, userId uuid.UUID) ([]Meta, error) {
	if userId == uuid.Nil {
		return nil, errors.New("userId is required")
	}
	rows, err := s.pg.Query(ctx,
		`SELECT id, name, created_at FROM maps
			WHERE
				id IN (SELECT map_id FROM map_roles
					WHERE user_id = $1 AND my_role = 'owner')
				AND deleted_at IS NULL
			ORDER BY created_at DESC`,
		userId,
	)
	if err != nil {
		s.l.DPanic("failed to query maps", zap.Error(err))
		return nil, err
	}
	defer rows.Close()
	var metas []Meta
	for rows.Next() {
		var meta Meta
		err := rows.Scan(&meta.Id, &meta.Name, &meta.CreatedAt)
		if err != nil {
			s.l.DPanic("failed to scan maps", zap.Error(err))
			return nil, err
		}
		metas = append(metas, meta)
	}
	return metas, nil
}

func (s *impl) ListSharedWith(ctx context.Context, userId uuid.UUID) ([]Meta, error) {
	if userId == uuid.Nil {
		return nil, errors.New("userId is required")
	}
	rows, err := s.pg.Query(ctx,
		`SELECT id, name, created_at FROM maps
			WHERE
				id IN (SELECT map_id FROM map_roles
					WHERE user_id = $1 AND my_role != 'owner')
				AND deleted_at IS NULL
			ORDER BY created_at DESC`,
		userId,
	)
	if err != nil {
		s.l.DPanic("failed to query maps", zap.Error(err))
		return nil, err
	}
	defer rows.Close()
	var metas []Meta
	for rows.Next() {
		var meta Meta
		err := rows.Scan(&meta.Id, &meta.Name, &meta.CreatedAt)
		if err != nil {
			s.l.DPanic("failed to scan maps", zap.Error(err))
			return nil, err
		}
		metas = append(metas, meta)
	}
	return metas, nil
}

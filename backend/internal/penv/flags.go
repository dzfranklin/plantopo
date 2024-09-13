package penv

import (
	"context"
	"errors"
	"github.com/dzfranklin/plantopo/backend/internal/psqlc"
	"github.com/jackc/pgx/v5/pgxpool"
	"log/slog"
	"sync"
	"time"
)

var q = psqlc.Queries{}

type FlagRepo struct {
	l         *slog.Logger
	mu        sync.Mutex
	boolFlags map[string]bool
	db        *pgxpool.Pool
	cancel    func()
}

func StartFlagRepo(l *slog.Logger, db *pgxpool.Pool, updateInterval time.Duration) *FlagRepo {
	ctx, cancel := context.WithCancel(context.Background())
	r := &FlagRepo{
		l:         l.With("app", "FlagRepo"),
		boolFlags: make(map[string]bool),
		db:        db,
		cancel:    cancel,
	}
	go r.runUpdater(ctx, updateInterval)
	return r
}

func (r *FlagRepo) Close() {
	r.cancel()
}

func (r *FlagRepo) BoolFlag(key string) bool {
	r.mu.Lock()
	defer r.mu.Unlock()
	return r.boolFlags[key]
}

func (r *FlagRepo) SetBoolFlag(key string, value bool) error {
	ctx, cancel := context.WithTimeout(context.Background(), time.Second*15)
	defer cancel()

	if key == "" {
		return errors.New("cannot set empty key")
	}

	if err := q.UpsertBoolFlag(ctx, r.db, key, value); err != nil {
		return err
	}

	r.mu.Lock()
	defer r.mu.Unlock()

	r.boolFlags[key] = value

	return nil
}

func (r *FlagRepo) DeleteBoolFlag(key string) error {
	ctx, cancel := context.WithTimeout(context.Background(), time.Second*15)
	defer cancel()

	if err := q.DeleteBoolFlag(ctx, r.db, key); err != nil {
		return err
	}

	r.mu.Lock()
	defer r.mu.Unlock()

	delete(r.boolFlags, key)

	return nil
}

func (r *FlagRepo) ListBoolFlags() map[string]bool {
	r.mu.Lock()
	defer r.mu.Unlock()
	out := make(map[string]bool, len(r.boolFlags))
	for k, v := range r.boolFlags {
		out[k] = v
	}
	return out
}

func (r *FlagRepo) runUpdater(ctx context.Context, updateInterval time.Duration) {
	for {
		if ctx.Err() != nil {
			return
		}
		r.updateNow()
		time.Sleep(updateInterval)
	}
}

func (r *FlagRepo) updateNow() {
	ctx, cancel := context.WithTimeout(context.Background(), time.Second*15)
	defer cancel()

	rows, err := q.SelectAllBoolFlags(ctx, r.db)
	if err != nil {
		r.l.Error("db error", "error", err)
	}

	r.mu.Lock()
	defer r.mu.Unlock()

	clear(r.boolFlags)
	for _, row := range rows {
		r.boolFlags[row.Key] = row.Value
	}
}

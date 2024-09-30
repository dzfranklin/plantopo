package psqlc

import (
	"context"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	pgxgeom "github.com/twpayne/pgx-geom"
)

func ConfigurePool(cfg *pgxpool.Config) {
	existingAfterConnect := cfg.AfterConnect
	cfg.AfterConnect = func(ctx context.Context, conn *pgx.Conn) error {
		if existingAfterConnect != nil {
			if err := existingAfterConnect(ctx, conn); err != nil {
				return err
			}
		}

		if err := pgxgeom.Register(ctx, conn); err != nil {
			return err
		}

		return nil
	}
}

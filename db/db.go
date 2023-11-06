package db

import (
	"context"
	"fmt"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
	pgxUUID "github.com/vgarvardt/pgx-google-uuid/v5"
)

type Pg struct {
	*pgxpool.Pool
	afterConnectHandlers []func(ctx context.Context, conn *pgx.Conn) error
}

type Querier interface {
	Begin(ctx context.Context) (pgx.Tx, error)
	Exec(ctx context.Context, sql string, arguments ...interface{}) (pgconn.CommandTag, error)
	Query(ctx context.Context, sql string, args ...interface{}) (pgx.Rows, error)
	QueryRow(ctx context.Context, sql string, args ...interface{}) pgx.Row
}

func NewPg(ctx context.Context, url string) (*Pg, error) {
	config, err := pgxpool.ParseConfig(url)
	if err != nil {
		return nil, fmt.Errorf("invalid postgres url: %w", err)
	}

	instance := &Pg{}

	config.AfterConnect = instance.afterConnect

	pool, err := pgxpool.NewWithConfig(ctx, config)
	if err != nil {
		return nil, err
	}
	instance.Pool = pool

	return instance, nil
}

func (p *Pg) AddAfterConnectHandler(handler func(ctx context.Context, conn *pgx.Conn) error) {
	p.afterConnectHandlers = append(p.afterConnectHandlers, handler)
}

func (p *Pg) afterConnect(ctx context.Context, conn *pgx.Conn) error {
	if _, err := conn.Exec(ctx, `SET search_path TO pt`); err != nil {
		return err
	}

	pgxUUID.Register(conn.TypeMap())

	for _, h := range p.afterConnectHandlers {
		if err := h(ctx, conn); err != nil {
			return err
		}
	}

	return nil
}

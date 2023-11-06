package testutil

import (
	"context"
	"errors"
	"fmt"
	"log"
	"time"

	"github.com/bitcomplete/sqltestutil"
	"github.com/danielzfranklin/plantopo/db"
	"github.com/danielzfranklin/plantopo/migrations"
	"github.com/golang-migrate/migrate/v4"
	_ "github.com/golang-migrate/migrate/v4/database/postgres"
	"github.com/jackc/pgx/v5"
)

// Pgx wraps a sandboxed postgres container
type Pgx struct {
	*sqltestutil.PostgresContainer
	*db.Pg
	m *migrate.Migrate
}

func PgxSandbox() *Pgx {
	log.Println("PgxSandbox: starting postgres container")
	container, err := sqltestutil.StartPostgresContainer(context.Background(), "14")
	if err != nil {
		log.Fatal(fmt.Errorf("PgxSandbox: failed to start postgres container: %w", err))
	}
	log.Printf("PgxSandbox: postgres container listening at %s", container.ConnectionString())

	// Fixes an intermittent bug when I test the entire project without any cached
	// results from the command line (i.e. `go clean -testcache && go test ./...`)
	time.Sleep(1 * time.Second)

	setupPg, err := pgx.Connect(context.Background(), container.ConnectionString()+"?sslmode=disable")
	if err != nil {
		log.Fatal(fmt.Errorf("PgxSandbox: failed to connect to postgres container: %w", err))
	}
	_, err = setupPg.Exec(
		context.Background(),
		"CREATE ROLE pt WITH LOGIN PASSWORD 'postgres'",
	)
	if err != nil {
		log.Fatal(fmt.Errorf("PgxSandbox: failed to execute: %w", err))
	}

	m, err := migrate.NewWithSourceInstance(
		"iofs",
		migrations.Iofs(),
		container.ConnectionString()+"?sslmode=disable",
	)
	if err != nil {
		log.Fatal(fmt.Errorf("PgxSandbox: failed to create migration instance: %w", err))
	}

	pg, err := db.NewPg(context.Background(), container.ConnectionString()+"?sslmode=disable")
	if err != nil {
		log.Fatal(fmt.Errorf("PgxSandbox: failed to create pg instance: %w", err))
	}

	c := &Pgx{container, pg, m}

	_, err = c.Exec(context.Background(), migrations.SetupScript("pgtest"))
	if err != nil {
		log.Fatal(fmt.Errorf("failed to execute setup script: %w", err))
	}

	c.migrateUp()

	log.Println("PgxSandbox: ready")
	return c
}

func (c *Pgx) Reset() {
	c.Pg.Reset()
	c.migrateDown()
	c.migrateUp()
	log.Println("PgxSandbox: reset")
}

func (c *Pgx) Close() {
	c.Pool.Close()
	if err := c.PostgresContainer.Shutdown(context.Background()); err != nil {
		log.Fatal(fmt.Errorf("PgxSandbox: failed to shutdown postgres container: %w", err))
	}
}

func (c *Pgx) migrateDown() {
	log.Println("PgxSandbox: migrating down")
	if err := c.m.Down(); err != nil && !errors.Is(err, migrate.ErrNoChange) {
		log.Fatal(fmt.Errorf("failed to migrate down: %w", err))
	}
}

func (c *Pgx) migrateUp() {
	log.Println("PgxSandbox: migrating up")

	if err := c.m.Up(); err != nil && !errors.Is(err, migrate.ErrNoChange) {
		log.Fatal(fmt.Errorf("failed to migrate up: %w", err))
	}
}

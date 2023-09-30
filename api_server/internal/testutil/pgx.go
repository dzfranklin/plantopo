package testutil

import (
	"context"
	"fmt"
	"log"
	"regexp"
	"time"

	"github.com/bitcomplete/sqltestutil"
	"github.com/danielzfranklin/plantopo/db"
	"github.com/danielzfranklin/plantopo/migrations"
	"github.com/golang-migrate/migrate/v4"
	_ "github.com/golang-migrate/migrate/v4/database/postgres"
	"github.com/jackc/pgx/v5"
)

// Sandboxed connection
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
	r := regexp.MustCompile("postgres://pgtest:.+@127.0.0.1:(.+)/pgtest")
	matches := r.FindStringSubmatch(container.ConnectionString())
	port := matches[1]
	log.Printf("PgxSandbox: postgres container listening on port %s", port)

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

	url := fmt.Sprintf("postgres://pt:postgres@127.0.0.1:%s/pgtest?sslmode=disable", port)
	pg, err := db.NewPg(context.Background(), url)
	if err != nil {
		log.Fatal(fmt.Errorf("PgxSandbox: failed to create pg instance: %w", err))
	}

	c := &Pgx{container, pg, m}

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
	c.PostgresContainer.Shutdown(context.Background())
}

func (c *Pgx) migrateDown() {
	log.Println("PgxSandbox: migrating down")
	if err := c.m.Down(); err != nil && err != migrate.ErrNoChange {
		log.Fatal(fmt.Errorf("failed to migrate down: %w", err))
	}
}

func (c *Pgx) migrateUp() {
	log.Println("PgxSandbox: migrating up")
	if err := c.m.Up(); err != nil && err != migrate.ErrNoChange {
		log.Fatal(fmt.Errorf("failed to migrate up: %w", err))
	}
}

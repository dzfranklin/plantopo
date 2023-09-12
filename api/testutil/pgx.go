package testutil

import (
	"context"
	"fmt"
	"log"

	"github.com/bitcomplete/sqltestutil"
	"github.com/danielzfranklin/plantopo/api/db"
	"github.com/danielzfranklin/plantopo/api/migrations"
	"github.com/golang-migrate/migrate/v4"
	_ "github.com/golang-migrate/migrate/v4/database/postgres"
)

// Sandboxed connection
type Pgx struct {
	*sqltestutil.PostgresContainer
	*db.Pg
	url string
	m   *migrate.Migrate
}

func PgxSandbox() *Pgx {
	log.Println("PgxSandbox: starting postgres container")
	container, err := sqltestutil.StartPostgresContainer(context.Background(), "14")
	if err != nil {
		log.Fatal(fmt.Errorf("PgxSandbox: failed to start postgres container: %w", err))
	}
	url := container.ConnectionString() + "?sslmode=disable"
	log.Printf("PgxSandbox: started postgres container at %s", url)

	m, err := migrate.NewWithSourceInstance(
		"iofs",
		migrations.Iofs(),
		url,
	)
	if err != nil {
		log.Fatal(fmt.Errorf("PgxSandbox: failed to create migration instance: %w", err))
	}

	pg, err := db.NewPg(context.Background(), url)
	if err != nil {
		log.Fatal(fmt.Errorf("PgxSandbox: failed to create pg instance: %w", err))
	}

	c := &Pgx{container, pg, url, m}

	c.migrateUp()

	log.Println("PgxSandbox: ready")
	return c
}

func (c *Pgx) Reset() {
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

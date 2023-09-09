package testutil

import (
	"context"
	"fmt"
	"log"

	"github.com/bitcomplete/sqltestutil"
	"github.com/danielzfranklin/plantopo/db"
	"github.com/danielzfranklin/plantopo/migrations"
	"github.com/golang-migrate/migrate/v4"
	_ "github.com/golang-migrate/migrate/v4/database/postgres"
)

// Sandboxed connection
type PgxSConn struct {
	*sqltestutil.PostgresContainer
	*db.Pg
	url string
}

func PgxSandbox() *PgxSConn {
	log.Println("PgxSandbox: starting postgres container")
	container, err := sqltestutil.StartPostgresContainer(context.Background(), "14")
	if err != nil {
		log.Fatal(fmt.Errorf("PgxSandbox: failed to start postgres container: %w", err))
	}
	url := container.ConnectionString() + "?sslmode=disable"
	log.Printf("PgxSandbox: started postgres container at %s", url)

	log.Println("PgxSandbox: migrating")
	m, err := migrate.NewWithSourceInstance(
		"iofs",
		migrations.Iofs(),
		url,
	)
	if err != nil {
		log.Fatal(fmt.Errorf("PgxSandbox: failed to create migration instance: %w", err))
	}
	if err := m.Up(); err != nil && err != migrate.ErrNoChange {
		log.Fatal(fmt.Errorf("failed to migrate: %w", err))
	}

	pg, err := db.NewPg(context.Background(), url)
	if err != nil {
		log.Fatal(fmt.Errorf("PgxSandbox: failed to create pg instance: %w", err))
	}

	log.Println("PgxSandbox: ready")
	return &PgxSConn{container, pg, url}
}

func (c *PgxSConn) Reset() {
	log.Println("PgxSandbox: resetting")

	m, err := migrate.NewWithSourceInstance("iofs", migrations.Iofs(), c.url)
	if err != nil {
		log.Fatal(fmt.Errorf("PgxSandbox: failed to create migration instance: %w", err))
	}
	if err := m.Drop(); err != nil && err != migrate.ErrNoChange {
		log.Fatal(fmt.Errorf("failed to drop: %w", err))
	}

	m, err = migrate.NewWithSourceInstance("iofs", migrations.Iofs(), c.url)
	if err != nil {
		log.Fatal(fmt.Errorf("PgxSandbox: failed to create migration instance: %w", err))
	}
	if err := m.Up(); err != nil && err != migrate.ErrNoChange {
		log.Fatal(fmt.Errorf("failed to migrate: %w", err))
	}
}

func (c *PgxSConn) Close() {
	c.Pool.Close()
	c.PostgresContainer.Shutdown(context.Background())
}

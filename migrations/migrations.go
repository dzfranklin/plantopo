package migrations

import (
	"embed"
	"fmt"

	"github.com/golang-migrate/migrate/v4/source"
	"github.com/golang-migrate/migrate/v4/source/iofs"
)

//go:embed *.sql
var embedded embed.FS

func Iofs() source.Driver {
	driver, err := iofs.New(embedded, ".")
	if err != nil {
		panic(fmt.Errorf("expected embedded migrations to be valid: %w", err))
	}
	return driver
}

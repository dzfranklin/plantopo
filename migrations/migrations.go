package migrations

import (
	"bytes"
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

func SetupScript(user string) string {
	tmpl, err := embedded.ReadFile("setup.sql")
	if err != nil {
		panic(fmt.Errorf("cannot read setup tmpl: %w", err))
	}
	script := bytes.Replace(tmpl, []byte("{{user}}"), []byte(user), -1)
	return string(script)
}

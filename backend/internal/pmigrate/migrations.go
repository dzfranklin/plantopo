package pmigrate

import _ "embed"

//go:embed migrations_gen.sql
var SQLToGenerateMigrationsSQL string

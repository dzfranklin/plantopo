export RUST_LOG := "watchexec_cli=error"

set dotenv-filename := "./backend/.env"

pre-commit:
    just api-gen

backend-test-watch:
    cd ./backend && watchexec --clear=clear --restart go test -race ./...

api-watch:
    cd ./backend && watchexec --clear=clear --restart go run ./cmd/api

api-schema-watch:
    watchexec --watch ./api/schema just api-schema-gen

api-schema-gen:
    spectral lint ./api/spec/schema.yaml --fail-severity warn --quiet
    redocly bundle --output api/schema.json api/schema/schema.yaml

    cp api/schema.json backend/internal/papi/schema.gen.json
    cd backend && ogen \
      -loglevel warn \
      -target internal/papi -package papi \
      -clean \
      ./internal/papi/schema.gen.json

sqlc-watch:
    cd backend && watchexec \
      --watch ./sqlc.yaml --watch ./migrations --watch ./internal/psqlc/queries \
      just sqlc-gen

sqlc-gen:
    cd backend && sqlc generate

migration name:
    tern --migrations backend/migrations new {{name}}

migrate *args:
     cd backend && tern --migrations migrations --conn-string "$DATABASE_URL" migrate {{args}}

migrate-prod-up:
    #!/usr/bin/env bash
    set -euox pipefail
    cd backend
    export PROD_DATABASE_URL=$(op read "op://plantopo/plantopo-prod/plantopo_migrator_prod/url")
    river migrate-up --database-url "$PROD_DATABASE_URL"
    tern migrate --conn-string "$PROD_DATABASE_URL" --migrations migrations

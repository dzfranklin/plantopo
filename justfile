export RUST_LOG := "watchexec_cli=error"

set dotenv-filename := "./backend/.env"

tmpdir  := `mktemp -d`

check-all:
    spectral lint ./api/schema/schema.yaml --fail-severity error

    cd app && npm run lint

    cd ./backend && go test -race ./...
    cd backend && staticcheck ./...
    cd backend && go vet ./...
    cd backend && test -z $(gofmt -l .)
    cd backend && go mod tidy && git diff --exit-code -- go.mod go.sum

gen:
    cd app && npm run build:dependency-report
    just api-schema-gen
    just sqlc-gen

backend-test-watch:
    cd ./backend && watchexec --clear=clear --restart go test -race ./...

api-watch:
    cd ./backend && watchexec --clear=clear --restart \
      'go build -race -o {{tmpdir}}/plantopo-api ./cmd/api && {{tmpdir}}/plantopo-api'

api-schema-watch:
    watchexec --watch ./api/schema just api-schema-gen

api-schema-gen:
    spectral lint ./api/schema/schema.yaml --fail-severity error

    cp api/schema/schema.yaml backend/internal/papi/schema.gen.yaml
    cd backend && ogen \
      -loglevel warn \
      -target internal/papi -package papi \
      -clean \
      ./internal/papi/schema.gen.yaml

    cd app && npx openapi-typescript ../api/schema/schema.yaml -o ./api/v1.d.ts

sqlc-watch:
    cd backend && watchexec \
      --watch ./sqlc.yaml --watch ./migrations --watch ./internal/psqlc/queries \
      just sqlc-gen

sqlc-gen:
    cd backend && sqlc generate

river-ui:
    docker pull ghcr.io/riverqueue/riverui:latest
    docker run -p 4003:8080 --env "DATABASE_URL=postgres://plantopo:password@host.docker.internal:5432/plantopo?sslmode=disable" ghcr.io/riverqueue/riverui:latest

migration name:
    tern --migrations backend/migrations new {{name}}

migrate *args:
     cd backend && tern --migrations migrations --conn-string "$DATABASE_URL" migrate {{args}}

migrate-prod-up:
    #!/usr/bin/env bash
    set -euox pipefail
    cd backend
    export PROD_DATABASE_URL=$(op read "op://plantopo/plantopo-prod/plantopo_prod/url")
    river migrate-up --database-url "$PROD_DATABASE_URL"
    tern migrate --conn-string "$PROD_DATABASE_URL" --migrations migrations

pre-commit:
    just check-all

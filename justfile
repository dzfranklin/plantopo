export RUST_LOG := "watchexec_cli=error"

set dotenv-filename := "./backend/.env"

tmpdir  := `mktemp -d`

dev:
    zellij delete-session plantopo >/dev/null; true
    zellij --layout layout.kdl --session plantopo

check:
    ./scripts/check-all.sh

gen:
    cd backend && test ! -f .env.local || cat .env.local | cut -d '=' -f 1 | xargs -I {} echo {}= >.env.local.example
    cd app && test ! -f .env.local || cat .env.local | cut -d '=' -f 1 | xargs -I {} echo {}= >.env.local.example

    cd app && npm run --silent build:dependency-report
    cd backend && mockery --log-level=warn
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
    redocly lint ./api/schema/openapi.yaml \
      --skip-rule operation-operationId \
      --skip-rule operation-4xx-response \
      --skip-rule tag-description \
      --skip-rule operation-operationId \
      --skip-rule no-server-example.com \
      --skip-rule info-license

    redocly bundle ./api/schema/openapi.yaml -o backend/internal/papi/schema.gen.json
    cd backend && ogen \
      -loglevel warn \
      -target internal/papi -package papi \
      -clean \
      ./internal/papi/schema.gen.json

    cd app && npx tsx ./api/genCmd.ts ../backend/internal/papi/schema.gen.json ./api/v1.d.ts && \
        npx prettier --write ./api/v1.d.ts

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

prod-psql:
    psql $(op read "op://plantopo/plantopo-prod/plantopo_prod/url")

loc:
    tokei . -e '*.sql.go' -e '*_gen.go' -e '*.gen.go' -e '*.d.ts' -t go,sql,css,tsx,typescript

deploy-geder-worker:
    cd backend && GOOS=linux GOARCH=amd64 go build -o /tmp/plantopo_geder_worker ./cmd/geder_worker
    rsync -aP /tmp/plantopo_geder_worker geder:/var/plantopo/worker
    ssh root@geder "systemctl restart plantopo-worker && systemctl status plantopo-worker"

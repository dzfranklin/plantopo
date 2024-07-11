export RUST_LOG := "watchexec_cli=error"

pre-commit:
    just api-gen

backend:
    #!/usr/bin/env bash
    just api-watch &
    cd ./backend && watchexec --restart go run ./cmd/api

api-watch:
    watchexec --restart --watch ./api/schema just api-gen

api-gen:
    spectral lint ./api/spec/schema.yaml --fail-severity warn
    redocly bundle --output api/schema.json api/schema/schema.yaml

    cp api/schema.json backend/internal/papi/schema.gen.json
    cd backend && go run github.com/ogen-go/ogen/cmd/ogen@latest \
      -target internal/papi -package papi \
      -clean \
      ./internal/papi/schema.gen.json

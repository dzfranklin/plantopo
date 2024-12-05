nprocs := `(test -f /proc/cpuinfo && grep -c 'processor' /proc/cpuinfo) || \
    (command -v sysctl 2>&1 >/dev/null && sysctl hw.ncpu | grep -o '[0-9]\+') \
    || echo 1`

export RUST_LOG := "watchexec_cli=error"

make:
    make -j{{nprocs}} -s

test:
    make test

dev:
    zellij delete-session --force plantopo >/dev/null; true
    zellij --new-session-with-layout layout.kdl --session plantopo

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

set shell := ["bash", "-cu"]

t: test-app test-go-short test-integration
  echo 'All tests passed (long go tests skipped)'

ta: test-app
tg: test-go-short
tgl: test-go-long
ti: test-integration

test-integration:
  ./api_server/tests/integration_test.sh

test-go-short:
  go test ./... -race -short -timeout 30s

test-go-long:
  go test ./... -race -timeout 30s

gen:
  rm -rf ./api/sync_schema/out && mkdir ./api/sync_schema/out
  rm -rf ./app/src/gen && mkdir ./app/src/gen

  go run ./api/sync_schema/generator
  cp ./api/sync_schema/out/schema.ts ./app/src/gen/sync_schema.ts
  
  go run ./sources
  mkdir -p app/src/gen && cp sources/out/mapSources.json app/src/gen

  protoc api/v1/*.proto \
    --go_out . \
    --go-grpc_out . \
    --go_opt paths=source_relative \
    --go-grpc_opt paths=source_relative \
    --proto_path=.

app:
  cd app && npm run dev -- --port 443 --experimental-https

test-app:
  cd app && tsc --noEmit
  cd app && npm run lint
  cd app && npm run test

migrationOpts := "x-migrations-table=%22pt%22.%22schema_migrations%22&x-migrations-table-quoted=true"

migrate *ARGS:
  migrate \
    -path=./migrations/ \
    -database "postgres://postgres:postgres@localhost:5432/pt?sslmode=disable&{{migrationOpts}}" \
    {{ ARGS }}

# Usage
# Go to <https://cloud.digitalocean.com/databases/db-postgresql-lon1-08658>
# Select user doadmin and database pt
# Copy connection string
# > read PROD_URL (paste copied)
# > just migrate-prod-up $PROD_URL

migrate-prod-up url:
  migrate \
    -verbose \
    -path=./migrations/ \
    -database "{{url}}&{{migrationOpts}}" \
    up

migrate-prod-down url:
    migrate \
    -verbose \
    -path=./migrations/ \
    -database "{{url}}&{{migrationOpts}}" \
    down 1

setup-prod-db user url:
   sed 's/{{{{user}}/{{user}}/' migrations/setup.sql | psql "{{url}}" -f -

recreatedb:
  dropdb --if-exists pt
  createdb pt
  psql -c "DROP ROLE pt; CREATE ROLE pt WITH LOGIN PASSWORD 'postgres'"
  migrate \
    -path=./migrations/ \
    -database "postgres://postgres:postgres@localhost:5432/pt?sslmode=disable&{{migrationOpts}}" \
    up
  psql -d pt \
    -f migrations/test_seed.sql

loc:
  tokei . -e '*.{json,xml,svg,txt,pb.go}'

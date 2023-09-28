set shell := ["bash", "-cu"]

t: test-app test-go-short test-integration test-build-prod
  echo 'All tests passed (long go tests skipped)'

ta: test-app
tg: test-go-short
tgl: test-go-long
ti: test-integration
tp: test-build-prod

test-integration:
  ./api/server/tests/integration_test.sh

test-build-prod:
  docker build -t plantopo:latest .

api *ARGS:
  caddy stop --config ./Caddyfile.development 2> /dev/null || true
  caddy start --config ./Caddyfile.development
  HOST=localhost PORT=3001 go run ./api/server {{ ARGS }}
  caddy stop --config ./Caddyfile.development

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

app:
  cd app && npm run dev

test-app:
  cd app && tsc --noEmit
  cd app && npm run lint
  cd app && npm run test

migrate *ARGS:
  docker run -v ./api/migrations:/migrations --network host migrate/migrate \
    -path=/migrations/ \
    -database postgres://postgres:postgres@localhost:5432/pt \
    {{ ARGS }}

# Usage
# Go to <https://cloud.digitalocean.com/databases/db-postgresql-lon1-08658>
# Select user doadmin and database pt
# Copy connection string
# > read PROD_URL (paste copied)
# > just migrate-prod-up $PROD_URL

migrate-prod-up url:
  docker run -v ./api/migrations:/migrations --network host migrate/migrate \
    -path=/migrations/ \
    -database {{url}} \
    up

migrate-prod-down url:
    docker run -v ./api/migrations:/migrations --network host migrate/migrate \
    -path=/migrations/ \
    -database {{url}} \
    down 1

recreatedb:
  dropdb --if-exists pt
  createdb pt
  docker run -v ./api/migrations:/migrations --network host migrate/migrate \
    -path=/migrations/ \
    -database postgres://postgres:postgres@localhost:5432/pt \
    up
  psql -d pt \
    -f api/migrations/test_seed.sql

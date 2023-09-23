set shell := ["bash", "-cu"]

t: test-app test-go test-integration

ta: test-app
tg: test-go
ti: test-integration

test-integration:
  ./api/server/tests/integration_test.sh

api:
  HOST=localhost PORT=3001 go run ./api/server

test-go *ARGS:
  go test ./... -race {{ ARGS }}

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
    -database postgres://postgres:postgres@localhost:5432/plantopo_api_dev \
    {{ ARGS }}

recreatedb:
  dropdb plantopo_api_dev
  createdb plantopo_api_dev
  docker run -v ./api/migrations:/migrations --network host migrate/migrate \
    -path=/migrations/ \
    -database postgres://postgres:postgres@localhost:5432/plantopo_api_dev \
    up
  psql -d plantopo_api_dev \
    -f api/migrations/test_seed.sql

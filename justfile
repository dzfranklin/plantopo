set shell := ["bash", "-cu"]

t: test-sources test-engine test-app test-go test-integration

tm: test-sources
te: test-engine
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
  cd ./api/sync_schema && go run ./gen
  cp ./api/sync_schema/out/schema.ts ./app/src/features/map/editor/api/sync_schema.ts
  
  cd map_sources && RUST_LOG=info cargo run .
  mkdir -p app/src/gen && cp map_sources/out/mapSources.json app/src/gen

caddy:
  caddy stop; caddy run

iex:
  cd web && iex -S mix server

app:
  cd app && npm run dev

ba:
  cd app && npm run build

# Build the app for profiling
bpa:
  cd app && npm run build -- --profile

find-unused:
  cd web && mix deps.unlock --check-unused

ci: ci-prepare-map-sources

test-engine:
  cd sync_engine && cargo check
  cd sync_engine && cargo clippy
  cd sync_engine && cargo test

test-sources:
  cd map_sources && cargo check
  cd map_sources && cargo clippy
  cd map_sources && cargo test
  cd map_sources && RUST_LOG=warn cargo run .

ci-prepare-map-sources:
  cd map_sources && cargo check
  cd map_sources && cargo clippy
  cd map_sources && cargo test
  cd map_sources && RUST_LOG=warn cargo run .

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

set shell := ["bash", "-cu"]

t: test-sources test-engine test-server test-app

tm: test-sources
te: test-engine
ts: test-server
ta: test-app

tsyncserver:
  go test ./server/mapsync -race

syncschema:
  cd ./sync_schema && go run ./gen

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

gen-sources:
  cd map_sources && RUST_LOG=info cargo run .

ci-prepare-map-sources:
  cd map_sources && cargo check
  cd map_sources && cargo clippy
  cd map_sources && cargo test
  cd map_sources && RUST_LOG=warn cargo run .

test-app:
  cd app && tsc --noEmit
  cd app && npm run lint
  cd app && npm run test

test-server:
  cd web && mix format --dry-run --check-formatted
  cd web && mix compile
  cd web && mix dialyzer
  cd web && mix test
  cd web && MIX_ENV=prod mix compile --all-warnings --no-compile --no-deps-check
  cd web && mix hex.audit

install-server-deps:
  cd web && mix local.hex --force
  cd web && mix deps.get
  cd web && mix deps.compile

migrate *ARGS:
  docker run -v ./migrations:/migrations --network host migrate/migrate \
    -path=/migrations/ \
    -database postgres://postgres:postgres@localhost:5432/plantopo_api_dev \
    {{ ARGS }}

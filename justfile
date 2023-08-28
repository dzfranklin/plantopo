set shell := ["bash", "-cu"]

t: test-map-sources test-engine test-server test-app

tm: test-map-sources
te: test-engine
ts: test-server
ta: test-app

iex:
  cd web && iex -S mix server

app:
  cd app && npm run dev

find-unused:
  cd web && mix deps.unlock --check-unused

test-engine:
  cd sync_engine && cargo check
  cd sync_engine && cargo clippy
  cd sync_engine && cargo test

test-map-sources:
  cd map_sources && cargo check
  cd map_sources && cargo clippy
  cd map_sources && cargo build
  cd map_sources && cargo test
  cd map_sources && RUST_LOG=warn cargo run .

test-app:
  cd app && tsc --noEmit
  cd app && npm run lint
  cd app && npm run test -- --passWithNoTests # TODO: add tests

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

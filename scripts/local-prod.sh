#!/bin/sh
set -e

api_env_file=$(mktemp)
trap 'rm -f "$api_env_file"' EXIT
NODE_ENV=production npx tsx scripts/with-api-env.ts > "$api_env_file"

web_build_env=$(cat \
  packages/web/.env \
  packages/web/.env.local \
  packages/web/.env.production \
  packages/web/.env.production.local \
  2>/dev/null || true)

createdb plantopo_prod 2>/dev/null || true

docker build -t plantopo --build-arg "WEB_BUILD_ENV=$web_build_env" .
docker run --rm -p 3030:4000 --env-file "$api_env_file" plantopo

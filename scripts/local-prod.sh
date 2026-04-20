#!/bin/sh
set -e

api_env_file=$(mktemp)
trap 'rm -f "$api_env_file"' EXIT
NODE_ENV=production npx tsx scripts/with-api-env.ts > "$api_env_file"

createdb plantopo_prod 2>/dev/null || true

docker build -t plantopo --build-arg "COMMIT_HASH=0000000" .
docker run --rm -p 3030:4000 --env-file "$api_env_file" plantopo

#!/usr/bin/env bash
set -euo pipefail

# INPUTS:
# Environment variables: SHORT_CHECK

# API
spectral lint ./api/schema/schema.yaml --fail-severity error &

# APP
cd app && npm run lint &
cd app && tsc --noEmit --project tsconfig.json &
cd app && npm run test -- run &

# BACKEND
if [[ -z "${SHORT_CHECK+x}" ]]; then
  cd ./backend && go test -race ./... &
else
  cd ./backend && go test -race -short ./... &
fi
cd backend && staticcheck ./... &
cd backend && go vet ./... &
cd backend && (test -z "$(gofmt -l .)" || echo 'GOFMT: would change file(s)' && exit 1) &
cd backend && go mod tidy -diff || echo 'GO MOD TIDY: would change file(s)' &

FAIL=0
for job in $(jobs -p); do
  wait "$job" || ((FAIL+=1))
done
if [ "$FAIL" == "0" ]; then
  echo "All checks passed"
else
  echo "$FAIL checks failed"
fi

#!/usr/bin/env bash
set -uo pipefail

# INPUTS:
# Environment variables: SHORT_CHECK

chronic() {
  tmp=$(mktemp) || exit 1
  "$@" >"$tmp" 2>&1
  ret=$?
  if [ "$ret" -ne 0 ]; then
    printf -- '-----------\nFAIL: %s\n-----------\n' "$*"
    cat "$tmp"
  fi
  rm -f "$tmp"
  return "$ret"
}

# APP
(cd app && chronic npx prettier . --check) &
(cd app && chronic npx next lint --max-warnings 0) &
(cd app && chronic tsc --noEmit --project tsconfig.json) &
(cd app && chronic npm run test -- run) &

# BACKEND
if [[ -z "${SHORT_CHECK+x}" ]]; then
  (cd ./backend && chronic go test -race ./...) &
else
  (cd ./backend && chronic go test -race -short ./...) &
fi
(cd backend && chronic staticcheck ./...) &
(cd backend && chronic test -z "$(gofmt -l .)")  &
(cd backend && chronic go mod tidy -diff) &

FAIL=0
for job in $(jobs -p); do
  wait "$job" || ((FAIL+=1))
done
if [ "$FAIL" == "0" ]; then
  echo "All checks passed"
else
  echo "$FAIL checks failed"
  exit 1
fi

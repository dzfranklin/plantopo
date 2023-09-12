#!/usr/bin/env bash
export HOST=localhost
export PORT=3002
export APP_ENV=development
export APP_QUIET=true

ENDPOINT="http://$HOST:$PORT"

wait_for_ready() {
  echo "Waiting for /healthz"
  printf 'GET %s\nHTTP 200' "$ENDPOINT/healthz" | hurl --retry 60 >/dev/null
  return 0
}

run_tests() {
  hurl --test ./server/tests/*.hurl \
    --error-format long \
    --variable endpoint="$ENDPOINT"
}

cleanup() {
  kill -SIGINT "$SERVER_PID"
  wait "$SERVER_PID"
}

if ! go build -o out github.com/danielzfranklin/plantopo/api/server; then
  echo "Failed to build server"
  exit 1
fi

./out/server &
SERVER_PID=$!

if wait_for_ready && run_tests; then
  echo "All tests passed!"
  cleanup
  exit 0
else
  echo "Some tests failed!"
  cleanup
  exit 1
fi

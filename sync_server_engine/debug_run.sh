#!/usr/bin/env bash
cd "$(dirname "$(realpath "$0")")" || exit 1

cargo build 2>/dev/null >/dev/null
BUILD_STATUS=$?

if [[ ${BUILD_STATUS} -ne 0 ]]; then
  printf 'Building sync_server_engine failed\r\n'
  exit ${BUILD_STATUS}
fi

exec ./target/debug/plantopo_sync_server_engine

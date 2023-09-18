#!/usr/bin/env bash
set -euo pipefail
cd ../sync_engine
exec crlfify-stdio cargo run -- "$@"

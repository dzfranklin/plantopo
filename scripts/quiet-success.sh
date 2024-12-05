#!/usr/bin/env bash
set -euo pipefail
if output=$("$@" 2>&1); then
  exit 0
else
  >&2 echo "$output"
  exit 1
fi

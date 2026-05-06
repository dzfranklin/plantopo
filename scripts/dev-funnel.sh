#!/usr/bin/env bash
set -euo pipefail

export PORT=4005
export METRICS_PORT=4006

tailscale funnel --bg --https=443 $PORT
trap 'tailscale funnel --https=443 off' EXIT

APP_URL=$(tailscale funnel status --json | jq -r '.Web | keys[0] | sub("^(?<u>.+):443$"; "https://\(.u)")')
export APP_URL

npm start

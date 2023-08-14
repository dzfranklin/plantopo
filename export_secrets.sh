#!/usr/bin/env bash
set -euo pipefail

export OP_SERVICE_ACCOUNT_TOKEN=$(cat .op_token)

export OS_API_KEY=$(op read op://plantopo/os_api_key/credential)
export MAPBOX_ACCESS_TOKEN=$(op read op://plantopo/mapbox_access_token/credential)
export MAXMIND_LICENSE_KEY=$(op read op://plantopo/maxmind_license_key/credential)
export MAPTILER_KEY=$(op read op://plantopo/maptiler_key/credential)

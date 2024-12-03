#!/usr/bin/env bash
set -euo pipefail

function configure() {
  mc mb dev/munro-access-reports
  mc mb dev/openstreetmap-traces
  mc mb dev/pmtiles-public

  mc admin user add dev minio_plantopo_dev password
  mc admin policy attach dev readwrite --user=minio_plantopo_dev
}

scratch=$(mktemp -d -t "plantopo_minio.XXXXXX")

unset MINIO_ACCESS_KEY
unset MINIO_SECRET_KEY
export MINIO_ROOT_USER=root
export MINIO_ROOT_PASSWORD=password
export MC_HOST_dev=http://$MINIO_ROOT_USER:$MINIO_ROOT_PASSWORD@localhost:8900

minio server --address ":8900" --console-address ":8901" "$scratch" &
minio=$!
trap 'kill $minio' EXIT

TIMEFORMAT="minio ready in %Rs"; time {
  until curl --silent --fail -o /dev/null "http://127.0.0.1:8900/minio/health/live"; do
    sleep 0.1
  done
}

TIMEFORMAT="configured in %Rs"; time {
  if ! (set -x; configure); then
    echo 'Setup failed'
    exit 1
  fi
}

wait "$minio"

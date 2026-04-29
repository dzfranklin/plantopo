#!/bin/bash
set -euox pipefail

if [ ! -f /.dockerenv ]; then
  echo "Error: this script must be run inside Docker" >&2
  exit 1
fi

unset NODE_ENV # Needed for environment variable loading in globalSetup

pg_ctlcluster 18 main --skip-systemctl-redirect start

redis-server /etc/redis/redis.conf
until redis-cli ping 2>/dev/null | grep -q PONG; do sleep 0.1; done

exec "$@"

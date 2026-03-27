#!/bin/sh
set -e
echo "entrypoint.sh"
node --enable-source-maps migrate.js
exec node --enable-source-maps server.js

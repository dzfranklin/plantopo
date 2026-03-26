#!/bin/sh
set -e
node --enable-source-maps migrate.js
exec node --enable-source-maps server.js

#!/bin/sh
node --enable-source-maps dist/migrate.js || echo >&2 "[ERROR] migrate.js failed, continuing..."
exec node --enable-source-maps dist/server.js

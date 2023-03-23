#!/usr/bin/env bash
set -euo pipefail
createdb --encoding=UTF8 osm
psql osm --command='CREATE EXTENSION postgis;'

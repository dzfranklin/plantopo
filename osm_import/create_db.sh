#!/usr/bin/env bash
set -euo pipefail
createdb --encoding=UTF8 osm2
psql osm2 --command='CREATE EXTENSION postgis;'

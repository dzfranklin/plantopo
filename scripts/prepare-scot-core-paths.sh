#!/usr/bin/env bash
set -euox pipefail

curl "https://geo.spatialhub.scot/geoserver/sh_cpth/wfs?service=WFS&authkey=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJqdGkiOiJ0SzdBcmJYcUxMaVVjTDd2OUhSOTdzLVlDdGhWVkJuWllFbU5QOW1aWDNBVFFsNzRqYU9obzFSX3lxMXE4UG04c0x3U1RzUXNCRWExNFpCciIsImlhdCI6MTcyNzUxOTA1NH0.73F7WFKmnJ4LuTYkJffZOSsEPuYGwLBfGWKqqz5gznA&request=GetFeature&typeName=sh_cpth:pub_cpth&format_options=filename:Core_Paths_-_Scotland&outputFormat=application/json" \
  --fail --no-clobber -o /tmp/core_paths.json

ogr2ogr -t_srs EPSG:4326 -f GEOJSON /tmp/core_paths_wgs84.json /tmp/core_paths.json

tippecanoe --output /tmp/core_paths.pmtiles --force \
  --layer=default \
  --generate-ids \
  --drop-smallest-as-needed \
  --base-zoom=g \
  --minimum-zoom=0 --maximum-zoom=14 \
  /tmp/core_paths_wgs84.json

mc cp /tmp/core_paths.pmtiles df/pmtiles-public/scot_core_paths.pmtiles

echo 'All done'
#!/usr/bin/env bash
set -euox pipefail

curl "https://geo.spatialhub.scot/geoserver/sh_cpth/wfs?service=WFS&authkey=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJqdGkiOiJ0SzdBcmJYcUxMaVVjTDd2OUhSOTdzLVlDdGhWVkJuWllFbU5QOW1aWDNBVFFsNzRqYU9obzFSX3lxMXE4UG04c0x3U1RzUXNCRWExNFpCciIsImlhdCI6MTcyNzUxOTA1NH0.73F7WFKmnJ4LuTYkJffZOSsEPuYGwLBfGWKqqz5gznA&request=GetFeature&typeName=sh_cpth:pub_cpth&format_options=filename:Core_Paths_-_Scotland&outputFormat=application/json" \
  --fail --no-clobber -o /tmp/core_paths.json

ogr2ogr -t_srs EPSG:4326 -f GEOJSON /tmp/core_paths_wgs84.json /tmp/core_paths.json

tippecanoe --output /tmp/core_paths.pmtiles --force \
  --name "Core Paths (Scotland)" --description "geo.spatialhub.scot" \
  --attribution "<a href=\"https://data.spatialhub.scot/dataset/core_paths-is\" target=\"_blank\">Improvement Service</a>" \
  --layer=default \
  --generate-ids \
  --drop-smallest-as-needed \
  --base-zoom=g \
  --no-tile-stats \
  /tmp/core_paths_wgs84.json

filename="scot_core_paths.pmtiles"

curl -X PUT -H "AccessKey: $BUNNY_STORAGE_KEY" --fail-with-body \
  "https://uk.storage.bunnycdn.com/plantopo/$filename" \
  --data-binary @/tmp/core_paths.pmtiles
echo 'Uploaded'

curl --get -H "AccessKey: $BUNNY_KEY" --fail-with-body "https://api.bunny.net/purge" \
  -d "url=https://plantopo-storage.b-cdn.net/$filename"
echo 'Purged cache'

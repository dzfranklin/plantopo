#!/usr/bin/env bash
set -euox pipefail

curl "https://gis-downloads.nature.scot/WLA_SCOTLAND_GEOJSON_4326.zip" \
  --fail --no-clobber -o /tmp/scot_wild_land_areas_2014.zip

unzip -p /tmp/scot_wild_land_areas_2014.zip WILDLAND_SCOTLAND.geojson | \
  jq >/tmp/scot_wild_land_areas_2014.json

tippecanoe --output /tmp/scot_wild_land_areas_2014.pmtiles --force \
  --layer=default \
  --generate-ids \
  --drop-smallest-as-needed \
  --base-zoom=g \
  --minimum-zoom=0 --maximum-zoom=14 \
  /tmp/scot_wild_land_areas_2014.json

mc cp /tmp/scot_wild_land_areas_2014.pmtiles df/pmtiles-public

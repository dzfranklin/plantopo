#!/usr/bin/env bash
set -euox pipefail

curl -G "https://ogc.nature.scot/geoserver/scottishforestry/ows" \
  --fail --no-clobber -o /tmp/caledonian_pinewood_inventory.json \
  -d service=WFS \
  -d request=GetFeature \
  -d typeName=scottishforestry:Caledonian_Pinewood_Inventory \
  -d outputFormat=application/json

ogr2ogr -t_srs EPSG:4326 -f GEOJSON \
  /tmp/caledonian_pinewood_inventory_wgs84.json /tmp/caledonian_pinewood_inventory.json

tippecanoe --output /tmp/caledonian_pinewood_inventory.pmtiles --force \
  --layer=default \
  --generate-ids \
  --drop-smallest-as-needed \
  --base-zoom=g \
  --minimum-zoom=0 --maximum-zoom=14 \
  /tmp/caledonian_pinewood_inventory_wgs84.json

mc cp /tmp/caledonian_pinewood_inventory.pmtiles df/pmtiles-public/

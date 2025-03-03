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
  --name "Caledonian Pinewood Inventory (Scotland)" --description "ogc.nature.scot" \
  --attribution "<a href=\"https://www.data.gov.uk/dataset/9fe00904-da11-44f7-97c3-f4e617e34ec7/caledonian-pinewood-inventory\" target=\"_blank\">Scottish Forestry</a>" \
  --layer=default \
  --generate-ids \
  --drop-smallest-as-needed \
  --base-zoom=g \
  --minimum-zoom=0 --maximum-zoom=14 \
  --no-tile-stats \
  /tmp/caledonian_pinewood_inventory_wgs84.json

filename="caledonian_pinewood_inventory.pmtiles"

curl -X PUT -H "AccessKey: $BUNNY_STORAGE_KEY" --fail-with-body \
  "https://uk.storage.bunnycdn.com/plantopo/$filename" \
  --data-binary @/tmp/caledonian_pinewood_inventory.pmtiles
echo 'Uploaded'

curl --get -H "AccessKey: $BUNNY_KEY" --fail-with-body "https://api.bunny.net/purge" \
  -d "url=https://plantopo-storage.b-cdn.net/$filename"
echo 'Purged cache'

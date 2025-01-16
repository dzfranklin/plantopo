#!/usr/bin/env bash
set -euox pipefail

inFile="WLA_SCOTLAND_GEOJSON_4326.zip"
curl "https://gis-downloads.nature.scot/$inFile" \
  --fail --no-clobber -o /tmp/scot_wild_land_areas_2014.zip

unzip -p /tmp/scot_wild_land_areas_2014.zip WILDLAND_SCOTLAND.geojson | \
  jq >/tmp/scot_wild_land_areas_2014.json

tippecanoe --output /tmp/scot_wild_land_areas_2014.pmtiles --force \
  --name "Wild Land Areas 2014 (Scotland)" --description "$inFile" \
  --attribution "<a href=\"https://www.nature.scot/professional-advice/landscape/landscape-policy-and-guidance/landscape-policy-wild-land\" target=\"_blank\">NatureScot</a>" \
  --layer=default \
  --generate-ids \
  --drop-smallest-as-needed \
  --base-zoom=g \
  --no-tile-stats \
  /tmp/scot_wild_land_areas_2014.json

filename="scot_wild_land_areas_2014.pmtiles"

curl -X PUT -H "AccessKey: $BUNNY_STORAGE_KEY" --fail-with-body \
  "https://uk.storage.bunnycdn.com/plantopo/$filename" \
  --data-binary @/tmp/scot_wild_land_areas_2014.pmtiles
echo 'Uploaded'

curl --get -H "AccessKey: $BUNNY_KEY" --fail-with-body "https://api.bunny.net/purge" \
  -d "url=https://plantopo-storage.b-cdn.net/$filename"
echo 'Purged cache'

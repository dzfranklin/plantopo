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
  /tmp/scot_wild_land_areas_2014.json

mc cp /tmp/scot_wild_land_areas_2014.pmtiles df/pmtiles-public

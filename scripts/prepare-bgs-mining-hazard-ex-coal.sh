#!/usr/bin/env bash

set -euox pipefail

curl "https://api.os.uk/downloads/v1/products/GB-Hex-1km-Mining-Haz/downloads?area=GB&format=GeoPackage&redirect" \
  -L --fail --compressed -o /tmp/bgs_mining_hazard_ex_coal.zip

unzip -p /tmp/bgs_mining_hazard_ex_coal.zip Hex_1km_MiningHazardNotIncludingCoalGB_v8.gpkg \
  >/tmp/bgs_mining_hazard_ex_coal.gpkg

ogr2ogr -of geojson /tmp/bgs_mining_hazard_ex_coal.json \
  -t_srs EPSG:4326 \
  /tmp/bgs_mining_hazard_ex_coal.gpkg Hex_1km_MiningHazardNotIncludingCoalGB_v8

tippecanoe --output /tmp/bgs_mining_hazard_ex_coal.pmtiles --force \
  --name "BGS Mining hazard (not including coal) 1 km hex grid" --description "OS OpenData" \
  --attribution "<a href=\"https://osdatahub.os.uk/downloads/open/GB-Hex-1km-Mining-Haz\" target=\"_blank\">British Geological Survey</a>" \
  --layer=default \
  --generate-ids \
  --base-zoom=g \
  -zg \
  /tmp/bgs_mining_hazard_ex_coal.json

mc cp /tmp/bgs_mining_hazard_ex_coal.pmtiles df/pmtiles-public

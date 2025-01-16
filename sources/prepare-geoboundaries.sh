#!/usr/bin/env bash
set -euox pipefail

release="CGAZ/geoBoundariesCGAZ_ADM0.geojson"
releaseURL="https://github.com/wmgeolab/geoBoundaries/raw/main/releaseData/$release"

curl "$releaseURL" \
  -L --fail -o /tmp/geoboundaries_adm0.json

tippecanoe --output /tmp/geoboundaries_polys.pmtiles --force \
  --generate-ids \
  -zg \
  -L adm0:/tmp/geoboundaries_adm0.json

tippecanoe --output /tmp/geoboundaries_labels.pmtiles --force \
  --generate-ids \
  -zg \
  --convert-polygons-to-label-points \
  -L adm0_label:/tmp/geoboundaries_adm0.json

filename="geoboundaries.pmtiles"
tile-join --output "/tmp/$filename" --force \
  --name "Geoboundaries" --description "$releaseURL" \
  --attribution '<a href="https://www.geoboundaries.org/">geoBoundaries</a>' \
  --no-tile-stats \
  /tmp/geoboundaries_polys.pmtiles /tmp/geoboundaries_labels.pmtiles

curl -X PUT -H "AccessKey: $BUNNY_STORAGE_KEY" --fail-with-body \
  "https://uk.storage.bunnycdn.com/plantopo/$filename" \
  --data-binary "@/tmp/$filename"

curl --get -H "AccessKey: $BUNNY_KEY" --fail-with-body "https://api.bunny.net/purge" \
  -d "url=https://plantopo-storage.b-cdn.net/$filename"

echo 'All done'

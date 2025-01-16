#!/usr/bin/env bash
set -euox pipefail

release="CGAZ/geoBoundariesCGAZ_ADM0.geojson"

curl "https://github.com/wmgeolab/geoBoundaries/raw/main/releaseData/$release" \
  -L --fail -o /tmp/geoboundaries_adm0.json

tippecanoe --output /tmp/geoboundaries.pmtiles --force \
  --name "Geoboundaries" --description "$release" \
  --attribution '<a href="https://www.geoboundaries.org/">geoBoundaries</a>' \
  --generate-ids \
  -zg \
  --no-tile-stats \
  -L adm0:/tmp/geoboundaries_adm0.json

filename="geoboundaries.pmtiles"

curl -X PUT -H "AccessKey: $BUNNY_STORAGE_KEY" --fail-with-body \
  "https://uk.storage.bunnycdn.com/plantopo/$filename" \
  --data-binary @/tmp/geoboundaries.pmtiles
echo 'Uploaded'

curl --get -H "AccessKey: $BUNNY_KEY" --fail-with-body "https://api.bunny.net/purge" \
  -d "url=https://plantopo-storage.b-cdn.net/$filename"
echo 'Purged cache'

echo 'All done'

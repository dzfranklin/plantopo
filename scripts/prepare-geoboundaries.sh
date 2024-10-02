set -euox pipefail

release="CGAZ/geoBoundariesCGAZ_ADM0.geojson"

curl "https://github.com/wmgeolab/geoBoundaries/raw/main/releaseData/$release" \
  -L --fail -o /tmp/geoboundaries_adm0.json

tippecanoe --output /tmp/geoboundaries.pmtiles --force \
  --name "Geoboundaries" --description "$release" \
  --attribution '<a href="https://www.geoboundaries.org/">geoBoundaries</a>' \
  --generate-ids \
  -zg \
  -L adm0:/tmp/geoboundaries_adm0.json

mc cp /tmp/geoboundaries.pmtiles  df/pmtiles-public/

echo 'All done'

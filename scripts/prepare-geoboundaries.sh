set -euox pipefail

#curl "https://github.com/wmgeolab/geoBoundaries/raw/main/releaseData/CGAZ/geoBoundariesCGAZ_ADM0.geojson" \
#  -L --fail -o /tmp/geoboundaries_adm0.json
#
tippecanoe --output /tmp/geoboundaries.pmtiles --force \
  --generate-ids \
  -zg \
  -L adm0:/tmp/geoboundaries_adm0.json

mc cp /tmp/geoboundaries.pmtiles  df/pmtiles-public/

echo 'All done'

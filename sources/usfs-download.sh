#!/usr/bin/env bash
set -euox pipefail

# Assumes the existence of github.com/dzfranklin/paper-maps

jq -r <../paper-maps/sources/usfs/raw.json \
  '.features.[] | .properties.secoord |tostring | "https://data.fs.usda.gov/geodata/rastergateway/downloadMap.php?mapID="+.+"&mapType=tif&seriesType=FSTopo"' \
  >/tmp/usfs_maps.txt

shuf </tmp/usfs_maps.txt | tail -n 1150 >/tmp/usfs_maps_sample.txt

mkdir -p "$HOME/scratch/fstopo"

wget -w 2 --random-wait -i /tmp/usfs_maps_sample.txt --directory-prefix "$HOME/scratch/fstopo/src" --trust-server-names

gdalbuildvrt -resolution highest "$HOME/scratch/fstopo/src.vrt" "$HOME/scratch/fstopo/src"*

gdal_translate -of vrt -expand rgb "$HOME/scratch/fstopo/src.vrt" "$HOME/scratch/fstopo/rgb.vrt"

gdal2tiles --resume --resampling=bilinear --xyz --zoom="2-16" --processes=8 --tiledriver=WEBP --webp-quality=75 \
  "$HOME/scratch/fstopo/rgb.vrt" "$HOME/scratch/fstopo/tiles_webp_75"

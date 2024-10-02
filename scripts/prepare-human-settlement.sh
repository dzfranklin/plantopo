#!/usr/bin/env bash

# <https://human-settlement.emergency.copernicus.eu/ghs_smod2023.php>
# <https://blog.mapbox.com/3d-mapping-global-population-density-how-i-built-it-141785c91107>

# The latest (Oct 2024) release of rio-mbtiles doesn't work on apple silicon. Try:
# pip3 install git+https://github.com/henrykironde/rio-mbtiles#caaa419a8c61d55240ea419cd201f5ef9b097a36

echo "Manually Download the global download (scroll down) of Copernicus Global Human Settlement Layer (Degree of Urbanisation)"
echo "https://human-settlement.emergency.copernicus.eu/download.php?ds=smod"
read -rp "Press enter once you have downloaded to /tmp/ghs.zip "

filenameInZip=$(unzip -l /tmp/ghs.zip | grep '.tif' | grep -v '.tif.ovr' | awk '{ print $4 }')
unzip -p /tmp/ghs.zip "$filenameInZip" >/tmp/ghs_input.tif

# gdal operates out of order so it is better to compress separately
gdalwarp /tmp/ghs_input.tif /tmp/ghs_uncompressed.tif -t_srs "epsg:4326"
gdal_translate /tmp/ghs_uncompressed.tif /tmp/ghs.tif \
  -co "COMPRESS=ZSTD" -co "TILED=YES" -co "PREDICTOR=2" -co "ZSTD_LEVEL=3"

cat >/tmp/ghs_colors.txt <<EOF
-200 0 0 0 0
10 0 0 0 0
11 0 0 0 0
12 0 0 0 30
13 0 0 255 40
21 0 0 255 50
22 0 0 255 60
23 0 0 255 70
30 0 0 255 80
EOF
gdaldem color-relief /tmp/ghs_uncompressed.tif /tmp/ghs_colors.txt /tmp/ghs_colors_uncompressed.tif \
       -alpha -nearest_color_entry

rm -rf /tmp/ghs_colors.mbtiles
rio mbtiles /tmp/ghs_colors_uncompressed.tif /tmp/ghs_colors.mbtiles \
  --format PNG --zoom-levels 0..8 --tile-size 512 --resampling bilinear \
  --title "Global Human Settlement - Urbanisation 1km" \
  --description "human-settlement.emergency.copernicus.eu"

sqlite3 /tmp/ghs_colors.mbtiles "INSERT INTO metadata (name, value) VALUES ('attribution', '<a href=\"https://human-settlement.emergency.copernicus.eu/ghs_smod2023.php\" target=\"_blank\">EC JRC</a>');"

pmtiles convert /tmp/ghs_colors.mbtiles /tmp/ghs_colors.pmtiles

mc cp /tmp/ghs.tif df/geodata/global_human_settlement_urbanisation_1km.tif
mc cp /tmp/ghs_colors.pmtiles df/pmtiles-public/global_human_settlement_urbanisation_1km_colors.pmtiles

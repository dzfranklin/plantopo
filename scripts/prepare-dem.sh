#!/usr/bin/env bash
set -euo pipefail

mkdir work
cd work

# -- USAGE
# Set the environment variable SSHPASS

# -- NOTES
# See <https://courses.spatialthoughts.com/gdal-tools.html#processing-elevation-data>

# -- Install dependencies

apt update
apt install -y unzip file gdal-bin gdal-data parallel sshpass

curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
unzip awscliv2.zip
sudo ./aws/install

wget "https://github.com/zellij-org/zellij/releases/download/v0.40.1/zellij-x86_64-unknown-linux-musl.tar.gz"
tar -xvf zellij*.tar.gz
chmod +x zellij
sudo mv zellij /usr/bin/

# -- Prepare chunks to process

echo "Downloading tile names"
aws s3 cp --no-sign-request s3://copernicus-dem-30m/tileList.txt tile_names

split --number=l/10 tile_names tile_names_

# -- Process each chunk

rm -rf compressed
mkdir -p compressed

for chunk in tile_names_*; do
  mkdir "$chunk"_input

  echo "Downloading $chunk"
  parallel <"$chunk" -d '\r\n' --halt now,fail=1 -j3 \
    aws s3 cp --no-sign-request "s3://copernicus-dem-30m/{}/{}.tif" ./"$chunk"_input/

  echo "Compressing $chunk"
  parallel <"$chunk" -d '\r\n' --halt now,fail=1 -j6 \
    gdal_calc.py --quiet \
       -A "$chunk""_input/{}.tif" --outfile "compressed/{}.tif" \
       --type=Int16 --calc="'numpy.round(A)'" \
       --co="COMPRESS=ZSTD" --co="TILED=YES" --co="PREDICTOR=2" --co "ZSTD_LEVEL=3"

  rm -r "$chunk"_input
done

# Potential future work: Fill Azerbaijan/Armenia

# -- Build index

# (Since we have only ~30,000 tiles a vrt file will work and is simpler to work with)

cd compressed

find . -name '*.tif' >tile_list
gdalbuildvrt -strict -resolution highest -input_file_list tile_list copernicus-dem-30m.vrt
rm tile_list

ssh-keyscan -p 23 u423943.your-storagebox.de >> ~/.ssh/known_hosts
sshpass -e ssh -p23 u423943@u423943.your-storagebox.de mkdir -p dem/copernicus-dem-30m
sshpass -e rsync -e "ssh -p23" -RPaul . u423943@u423943.your-storagebox.de:dem/copernicus-dem-30m/

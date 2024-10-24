#!/usr/bin/env bash

# B. Thomee, D.A. Shamma, G. Friedland, B. Elizalde, K. Ni, D. Poland, D. Borth, and L. Li, “YFCC100M: The New Data in Multimedia Research”, Communications of the ACM, 59(2), 2016, pp. 64-73
# 99.2M flickr photos uploaded between 2004 and 2014 and published under a CC commercial or noncommercial license

# TODO: Maybe for both geograph and flickr we have one-off prepare scripts that load into the database
# TODO: is the gps accurate enough back in 2014?

wget "https://multimedia-commons.s3-us-west-2.amazonaws.com/tools/etc/yfcc100m_dataset.sql"

sqlite3 -readonly -csv -header yfcc100m_dataset.sql \
  "select * from yfcc100m_dataset where latitude != '' AND longitude != ''" \
  | gzip >yfcc_geo.csv.gz

curl -X PUT -H "AccessKey: $BUNNY_STORAGE_KEY" --fail-with-body \
  "https://uk.storage.bunnycdn.com/plantopo/yfcc_geo.csv.gz" \
  -T yfcc_geo.csv.gz -o /dev/null

# yfcc_geo.csv has 48,469,830 lines and is 26.3 GB (4.6 GB compressed)

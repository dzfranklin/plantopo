#!/usr/bin/env bash
# Download from <https://download.geofabrik.de/north-america/us/colorado.html>
# and <https://download.geofabrik.de/europe.html>
# Run ./import.sh ~/Downloads/great-britain-latest.osm.pbf ~/Downloads/colorado-latest.osm.pbf
osm2pgsql -d osm -O flex --number-processes 16 -S ./import.lua "$@"

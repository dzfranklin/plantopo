#!/bin/bash
set -euo pipefail

FONTS_DIR="${FONTS_DIR:-.fonts}"
ZIP_URL="https://github.com/dzfranklin/plantopo/releases/download/fonts/Source_Sans_3.zip"

# Check if all static fonts are already present
all_present=1
for name in \
  SourceSans3-ExtraLight SourceSans3-ExtraLightItalic \
  SourceSans3-Light SourceSans3-LightItalic \
  SourceSans3-Regular SourceSans3-Italic \
  SourceSans3-Medium SourceSans3-MediumItalic \
  SourceSans3-SemiBold SourceSans3-SemiBoldItalic \
  SourceSans3-Bold SourceSans3-BoldItalic \
  SourceSans3-ExtraBold SourceSans3-ExtraBoldItalic \
  SourceSans3-Black SourceSans3-BlackItalic
do
  if [ ! -f "$FONTS_DIR/$name.ttf" ]; then
    all_present=0
    break
  fi
done

if [ "$all_present" = "1" ]; then
  echo "Fonts already present in $FONTS_DIR"
  exit 0
fi

mkdir -p "$FONTS_DIR"

TMP_ZIP=$(mktemp /tmp/source-sans-3-XXXXXX.zip)
echo "Downloading fonts to $FONTS_DIR..."
curl -fsSL "$ZIP_URL" -o "$TMP_ZIP"
unzip -jo "$TMP_ZIP" "static/*.ttf" -d "$FONTS_DIR"
rm "$TMP_ZIP"
echo "Fonts downloaded."

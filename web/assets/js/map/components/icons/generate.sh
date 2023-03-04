#!/usr/bin/env bash

npx @svgr/cli --out-dir . -- ../../../../../../design/icons
rm -f ./*.tsx
rename 's/\.js$/.tsx/' ./*Icon.js
mv index.js index.ts
pushd ../../../../ && npx eslint js/map/components/icons --fix
popd || exit 1

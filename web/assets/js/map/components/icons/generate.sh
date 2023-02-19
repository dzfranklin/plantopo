#!/usr/bin/env bash

npx @svgr/cli --out-dir . -- ../../../../../../design/icons
rm -f ./*.tsx
rename 's/\.js$/.tsx/' ./*Icon.js
mv index.js index.ts

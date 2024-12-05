#!/bin/sh
':' //; exec npm --prefix "$(dirname "$0")" exec tsx "$0" "$@"

import fs from 'node:fs';
import openapiTS, { astToString, COMMENT_HEADER } from 'openapi-typescript';
import ts from 'typescript';

const inputPath = process.argv[2];
if (!inputPath) {
  throw new Error('missing inputPath');
}

const outputPath = process.argv[3];
if (!outputPath) {
  throw new Error('missing outputPath');
}

const schemaString = fs.readFileSync(inputPath, 'utf8');
const schema = JSON.parse(schemaString);

const IMPORT_HEADER = `import * as geojson from 'geojson';\n\n`;

openapiTS(schema, {
  arrayLength: true,
  alphabetize: true,
  transform: (obj, _meta) => {
    if ('x-ts-type' in obj) {
      const tsType = obj['x-ts-type'];
      return ts.factory.createIdentifier(tsType) as any;
    }
    return undefined;
  },
}).then((ast) => {
  fs.writeFileSync(
    outputPath,
    COMMENT_HEADER + IMPORT_HEADER + astToString(ast),
  );
});

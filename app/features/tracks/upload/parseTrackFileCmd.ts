// This file is executed by scripts/parse-track-file.sh

import { parseTrackFile } from './parseTrackFile';
import { basename } from 'node:path';
import { promises as fs } from 'node:fs';
import { JSDOM } from 'jsdom';
import { ParsedTrack } from '@/features/tracks/upload/schema';
import { TrackCreate } from '@/features/tracks/schema';
import { DateTime } from 'luxon';
import { encodePolyline } from '@/features/tracks/polyline';

global.DOMParser = new JSDOM().window.DOMParser;

const inputPath = process.argv[2];
if (!inputPath) {
  throw new Error('missing inputPath');
}

const inputFile = {
  name: basename(inputPath),
  text: () => fs.readFile(inputPath),
};

function processTrack(track: ParsedTrack): TrackCreate {
  return {
    name: track.name,
    date: track.date || DateTime.now().toISO(),
    line: encodePolyline(track.line),
    times: track.times,
  };
}

parseTrackFile(inputFile as unknown as File).then(
  (res) => {
    console.log(JSON.stringify(res.map(processTrack), null, 2));
  },
  (err) => {
    throw err;
  },
);

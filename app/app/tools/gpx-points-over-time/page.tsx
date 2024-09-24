'use client';

import { Layout } from '@/components/Layout';
import FileUpload from '@/components/FileUpload';
import { useState } from 'react';
import { parseTrackFile } from '@/features/tracks/upload/parseTrackFile';
import InlineAlert from '@/components/InlineAlert';
import {
  TrackWithTiming,
  TrackPointsOverTime,
} from '@/app/tools/gpx-points-over-time/TrackPointsOverTime';

export default function Page() {
  const [parseError, setParseError] = useState<string | null>(null);
  const [track, setTrack] = useState<TrackWithTiming | null>(null);
  return (
    <Layout pageTitle="Visualize GPX points over time">
      {track === null && (
        <div className="w-full max-w-lg">
          <FileUpload
            multiple={false}
            accept=".gpx"
            onChange={(e) => {
              const file = e.currentTarget.files?.[0];
              if (!file) return;
              setTrack(null);
              parseTrackFile(file).then(
                (parsed) => {
                  if (parsed.length === 0) {
                    setParseError('No tracks found in file');
                    return;
                  }
                  if (parsed.length > 1) {
                    setParseError(
                      'More than one track in a file is not currently supported',
                    );
                    return;
                  }
                  const parsedTrack = parsed[0]!;

                  if (!parsedTrack.times) {
                    setParseError(
                      'File does not contain timing information for track points',
                    );
                    return;
                  }

                  setTrack(parsedTrack as TrackWithTiming);
                },
                (err) => setParseError(err.toString()),
              );
            }}
          />
        </div>
      )}

      {parseError && <InlineAlert variant="error">{parseError}</InlineAlert>}

      {track && <TrackPointsOverTime track={track} />}
    </Layout>
  );
}

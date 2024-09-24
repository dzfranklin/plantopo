'use client';

import { Layout } from '@/components/Layout';
import TrackStatsComponent from '@/features/tracks/TrackStats';
import TrackMapComponent from '@/features/tracks/TrackMapComponent';
import Skeleton from '@/components/Skeleton';
import { useCallback, useMemo, useState } from 'react';
import { decodePolyline } from '@/features/tracks/polyline';
import ElevationChartComponent from '@/features/tracks/ElevationChartComponent';
import { TrackUpdate } from '@/features/tracks/schema';
import { TrackScreenHeading } from '@/app/tracks/[id]/TrackScreenHeading';
import { TrackDescription } from '@/features/tracks/TrackDescription';
import { useTrackQuery } from '@/features/tracks/queries';
import { useElevationQuery } from '@/features/elevation/queries';

export function TrackScreen({ id }: { id: string }) {
  const query = useTrackQuery(id);
  const track = query?.data?.track;

  const line = useMemo(
    () => (track?.line ? decodePolyline(track.line) : undefined),
    [track?.line],
  );

  const [edit, setEdit] = useState<TrackUpdate | null>(null);
  const updateEdit = useCallback(
    (changes: TrackUpdate) => setEdit((p) => ({ ...p, ...changes })),
    [],
  );
  const endEdit = useCallback(() => setEdit(null), []);

  return (
    <Layout
      pageTitle={query.data ? track?.name || 'Unnamed track' : 'Loading...'}
      inlineTitle={false}
    >
      <div className="space-y-6">
        <TrackScreenHeading
          id={id}
          edit={edit}
          updateEdit={updateEdit}
          endEdit={endEdit}
        />

        <TrackStatsComponent id={id} edit={edit} updateEdit={updateEdit} />

        <TrackDescription id={id} edit={edit} updateEdit={updateEdit} />

        <div className="h-[400px]">
          {line ? <TrackMapComponent line={line} /> : <Skeleton />}
        </div>

        {line ? <TrackElevationContainer line={line} /> : <ElevationSkeleton />}
      </div>
    </Layout>
  );
}

function TrackElevationContainer({ line }: { line: [number, number][] }) {
  const query = useElevationQuery(line);

  if (!query.data) {
    return <ElevationSkeleton />;
  }

  return (
    <ElevationChartComponent
      coordinates={line}
      elevations={query.data.elevation}
      onMarkDistance={() => {
        /*TODO: */
      }}
    />
  );
}

function ElevationSkeleton() {
  return <Skeleton height={200} />;
}

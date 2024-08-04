'use client';

import { Track } from '@/features/tracks/api';
import ElevationChartComponent from '@/features/tracks/ElevationChartComponent';
import TrackMapComponent from '@/features/tracks/TrackMapComponent';
import TrackStatsComponent from '@/features/tracks/TrackStats';
import { useState } from 'react';

export default function TrackView({ track }: { track: Track }) {
  const geojson = track.geojson;
  const props = geojson.properties;
  const coordProps = props.coordinateProperties;

  const [markDistance, setMarkDistance] = useState<number | undefined>();

  return (
    <div className="w-full max-w-3xl space-y-8">
      <TrackStatsComponent track={track} />

      <TrackMapComponent track={track} markDistance={markDistance} />

      {coordProps?.elevationMeters && coordProps?.times && (
        <ElevationChartComponent
          coordinates={geojson.geometry.coordinates}
          elevations={coordProps.elevationMeters}
          onMarkDistance={setMarkDistance}
        />
      )}
    </div>
  );
}

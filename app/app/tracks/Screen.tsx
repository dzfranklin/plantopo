'use client';

import { TrackGrid } from '@/features/tracks/TrackGrid';
import { useSearchParams } from 'next/navigation';

export function TracksScreen() {
  const searchParams = useSearchParams();

  return (
    <div className="h-full min-h-full">
      <TrackGrid
        options={searchParams.get('options') ?? undefined}
        setOptions={(options) => {
          history.replaceState(null, '', '?options=' + options);
        }}
      />
    </div>
  );
}

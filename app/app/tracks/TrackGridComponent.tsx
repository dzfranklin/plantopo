'use client';

import TrackPreview from '@/features/tracks/TrackPreview';
import { Track } from '@/features/tracks/api';
import useResizeObserver from '@/hooks/useResizeObserver';
import Link from 'next/link';
import { useRef, useState } from 'react';

export default function TrackGridComponent({ track }: { track: Track }) {
  const [size, setSize] = useState<[number, number] | null>(null);
  const container = useRef<HTMLDivElement>(null);
  useResizeObserver(container, (entries) => {
    if (entries.length > 0) {
      const entry = entries[0]!;
      setSize([entry.contentRect.width, entry.contentRect.height]);
    }
  });

  return (
    <>
      <div className="group aspect-h-7 aspect-w-10 block w-full overflow-hidden rounded-lg bg-gray-100 focus-within:ring-2 focus-within:ring-indigo-500 focus-within:ring-offset-2 focus-within:ring-offset-gray-100">
        <div ref={container}>
          {size && (
            <TrackPreview
              padding={20}
              width={Math.floor(size[0] + 0.5)}
              height={Math.floor(size[1] + 0.5)}
              geojson={track.geojson}
              alt="map"
              className="pointer-events-none object-cover group-hover:opacity-75"
            />
          )}
        </div>

        <Link
          href={'/tracks/' + track.id}
          className="absolute inset-0 focus:outline-none"
        >
          <span className="sr-only">View details for {track.name}</span>
        </Link>
      </div>
      <p className="pointer-events-none mt-2 block truncate text-sm font-medium text-gray-900">
        {track.name}
      </p>
      <p className="pointer-events-none block text-sm font-medium text-gray-500">
        {track.time}
      </p>
    </>
  );
}

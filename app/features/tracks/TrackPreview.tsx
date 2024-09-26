'use client';

import 'leaflet/dist/leaflet.css';
import { Fragment, useEffect, useRef, useState } from 'react';
import {
  decodePolyline,
  flipCoordinateOrder,
} from '@/features/tracks/polyline';
import { bbox as computeBBox } from '@turf/bbox';
import { lineString } from '@turf/helpers';
import { MAPTILER_KEY } from '@/env';
import Link from 'next/link';

/* NOTE: The mapbox static maps api seems like it would be ideal for this, but it is too unreliable. I get 404
 errors, especially when I display a number of maps at once. Other users report similar issues. */

export default function TrackPreview({
  polyline,
  href,
  padding,
  ...divProps
}: {
  polyline: string;
  href: string;
  padding?: number;
} & JSX.IntrinsicElements['div']) {
  padding = padding || 20;

  const ref = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!ref.current || typeof window === 'undefined') return;
    const el = ref.current;
    let cleanup: () => void | undefined;
    let cancelled = false;

    (async () => {
      const L = (await import('leaflet')).default;
      if (cancelled) return;

      const line = decodePolyline(polyline);
      const bbox = computeBBox(lineString(line));

      const map = L.map(el, {
        zoomControl: false,
        dragging: false,
        touchZoom: false,
        doubleClickZoom: false,
        scrollWheelZoom: false,
        boxZoom: false,
        keyboard: false,
        attributionControl: false,
        zoomAnimation: false, // Required to prevent an error with react-window
      });

      cleanup = () => {
        map.remove();
      };

      map.fitBounds(
        [
          [bbox[1], bbox[0]],
          [bbox[3], bbox[2]],
        ],
        { padding: [padding, padding] },
      );

      L.tileLayer(
        `https://api.maptiler.com/maps/topo-v2/{z}/{x}/{y}.png?key=${MAPTILER_KEY}`,
        {
          tileSize: 512,
          zoomOffset: -1,
          minZoom: 1,
          attribution:
            '\u003ca href="https://www.maptiler.com/copyright/" target="_blank"\u003e\u0026copy; MapTiler\u003c/a\u003e \u003ca href="https://www.openstreetmap.org/copyright" target="_blank"\u003e\u0026copy; OpenStreetMap contributors\u003c/a\u003e',
          crossOrigin: true,
        },
      ).addTo(map);

      L.polyline(flipCoordinateOrder(line), {
        color: '#3761e2',
        weight: 3,
        interactive: false,
      }).addTo(map);

      setReady(true);
    })();

    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, [polyline, padding]);

  return (
    <div className="relative w-full h-full max-h-full max-w-full rounded-md clip">
      <Link href={href}>
        <div
          {...divProps}
          ref={ref}
          className="w-full h-full max-h-full max-w-full"
        >
          {!ready && <TrackPreviewSkeleton />}
        </div>
      </Link>
      <LeafletAttribution />
    </div>
  );
}

export function TrackPreviewSkeleton() {
  return (
    <div
      role="status"
      className="w-full h-full bg-gray-300 rounded-lg animate-pulse"
    >
      <span className="sr-only">Loading...</span>
    </div>
  );
}

function LeafletAttribution() {
  return (
    <>
      <div className="absolute top-0 right-0 z-[800] text-[12px]">
        <div className="bg-white bg-opacity-80 px-[5px] color-[#333] leading-[1.4] relative float-left clear-both">
          <a
            href="https://leafletjs.com"
            title="A JavaScript library for interactive maps"
            target="_blank"
            className="no-underline hover:underline text-[#0078A8]"
          >
            <svg
              aria-hidden="true"
              xmlns="http://www.w3.org/2000/svg"
              width="12"
              height="8"
              viewBox="0 0 12 8"
              className="leaflet-attribution-flag mr-1"
            >
              <path fill="#4C7BE1" d="M0 0h12v4H0z"></path>
              <path fill="#FFD500" d="M0 4h12v3H0z"></path>
              <path fill="#E0BC00" d="M0 7h12v1H0z"></path>
            </svg>
            Leaflet
          </a>
        </div>
      </div>

      <div className="absolute bottom-0 right-0 z-[800] text-[12px]">
        <div className="bg-white bg-opacity-80 px-[5px] color-[#333] leading-[1.4] relative float-left clear-both">
          <a
            href="https://www.maptiler.com/copyright/"
            target="_blank"
            className="no-underline hover:underline text-[#0078A8]"
          >
            &copy; MapTiler
          </a>{' '}
          <a
            href="https://www.openstreetmap.org/copyright"
            target="_blank"
            className="no-underline hover:underline text-[#0078A8]"
          >
            &copy; OpenStreetMap contributors
          </a>
        </div>
      </div>
    </>
  );
}

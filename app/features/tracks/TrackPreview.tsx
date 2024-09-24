'use client';

import 'leaflet/dist/leaflet.css';
import { useEffect, useRef, useState } from 'react';
import {
  decodePolyline,
  flipCoordinateOrder,
} from '@/features/tracks/polyline';
import { bbox as computeBBox } from '@turf/bbox';
import { lineString } from '@turf/helpers';
import { MAPTILER_KEY } from '@/env';

/* NOTE: The mapbox static maps api seems like it would be ideal for this, but it is too unreliable. I get 404
 errors, especially when I display a number of maps at once. Other users report similar issues. */

export default function TrackPreview({
  polyline,
  width,
  height,
  padding,
  ...divProps
}: {
  polyline: string;
  width?: number;
  height?: number;
  padding?: number;
} & JSX.IntrinsicElements['div']) {
  padding = padding || 20;
  width = width || 427;
  height = height || 240;

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

      // Split up the attribution so it fits on a single line in our small map.
      // The leaflet prefix is added separately below.
      L.control.attribution({ prefix: '' }).addTo(map);

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

  if (!width || !height) return;

  return (
    <div {...divProps} ref={ref} className="w-full h-full rounded-lg clip">
      {ready && <TopRightLeafletAttribution />}
      {!ready && <TrackPreviewSkeleton />}
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

function TopRightLeafletAttribution() {
  return (
    <div className="leaflet-top leaflet-right">
      <div className="leaflet-control-attribution leaflet-control">
        <a
          href="https://leafletjs.com"
          title="A JavaScript library for interactive maps"
        >
          <svg
            aria-hidden="true"
            xmlns="http://www.w3.org/2000/svg"
            width="12"
            height="8"
            viewBox="0 0 12 8"
            className="leaflet-attribution-flag"
          >
            <path fill="#4C7BE1" d="M0 0h12v4H0z"></path>
            <path fill="#FFD500" d="M0 4h12v3H0z"></path>
            <path fill="#E0BC00" d="M0 7h12v1H0z"></path>
          </svg>
          Leaflet
        </a>
      </div>
    </div>
  );
}

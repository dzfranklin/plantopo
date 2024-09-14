'use client';

import Skeleton from '@/components/Skeleton';
import { Track } from './api';
import { RefObject, useEffect, useRef, useState } from 'react';
import * as ml from 'mapbox-gl';
import { MAPBOX_TOKEN } from '@/env';
import { bbox as computeBBox } from '@turf/bbox';
import { along as computeAlong } from '@turf/along';
import 'mapbox-gl/dist/mapbox-gl.css';
import { useSettings } from '@/features/settings/useSettings';

export default function TrackMapComponent({
  track,
  markDistance,
}: {
  track: Track;
  markDistance?: number;
}) {
  const [showSkeleton, setShowSkeleton] = useState(true);

  const ref = useRef<HTMLDivElement>(null);

  const { units } = useSettings();
  const initialUnits = useRef(units);
  const scaleRef = useRef<ml.ScaleControl | null>(null);
  useEffect(() => {
    initialUnits.current = units;
  }, [units]);

  const initialMarkDistance = useRef(markDistance);
  const markDistanceMarkerRef = useRef<ml.Marker | null>(null);
  useEffect(() => {
    initialMarkDistance.current = markDistance;
  }, [markDistance]);

  useEffect(() => {
    if (!ref.current) return;
    const el = ref.current;

    setShowSkeleton(false);

    const bbox = computeBBox(track.geojson);

    const map = new ml.Map({
      container: el,
      accessToken: MAPBOX_TOKEN,
      style: 'mapbox://styles/dzfranklin/clxlno49r00er01qq3ppk4wwo',
      bounds: bbox as ml.LngLatBoundsLike,
      logoPosition: 'bottom-right',
      fitBoundsOptions: {
        padding: 50,
      },
    });

    map.on('style.load', () => {
      map.addControl(new ml.FullscreenControl());
      map.addControl(new ml.NavigationControl());

      const scaleControl = new ml.ScaleControl({
        unit:
          initialUnits.current === 'customary'
            ? 'imperial'
            : initialUnits.current,
      });
      map.addControl(scaleControl);
      scaleRef.current = scaleControl;

      map.addSource('track', {
        type: 'geojson',
        data: track.geojson,
      });

      map.addLayer({
        id: 'track-line',
        type: 'line',
        source: 'track',
        layout: {
          'line-join': 'round',
          'line-cap': 'round',
        },
        paint: {
          'line-color': '#3761e2',
          'line-width': 4,
        },
      });

      const markDistanceMarker = new ml.Marker({});
      markDistanceMarker.setLngLat([0, 0]);
      markDistanceMarker.addTo(map);
      markDistanceMarkerRef.current = markDistanceMarker;
      syncMarkDistanceMarker(
        markDistanceMarkerRef,
        track.geojson,
        initialMarkDistance.current,
      );
    });

    return () => {
      map.remove();
    };
  }, [track.geojson]);

  useEffect(() => {
    if (!scaleRef.current) return;
    if (units === 'customary') {
      scaleRef.current.setUnit('imperial');
    } else {
      scaleRef.current.setUnit('metric');
    }
  }, [units]);

  useEffect(() => {
    syncMarkDistanceMarker(markDistanceMarkerRef, track.geojson, markDistance);
  }, [markDistance, track.geojson]);

  return (
    <div className="h-[400px] relative">
      {showSkeleton && (
        <div className="absolute inset-0">
          <Skeleton />
        </div>
      )}
      <div className="absolute inset-0">
        <div ref={ref} className="h-full w-full" />
      </div>
    </div>
  );
}

function syncMarkDistanceMarker(
  marker: RefObject<ml.Marker>,
  geojson: Track['geojson'],
  markDistance?: number,
) {
  if (!marker.current) return;
  const el = marker.current.getElement();
  if (markDistance === undefined) {
    el.style.display = 'none';
  } else {
    el.style.display = 'block';
    const p = computeAlong(geojson, markDistance, { units: 'meters' }).geometry
      .coordinates;
    marker.current.setLngLat(p as ml.LngLatLike);
  }
}

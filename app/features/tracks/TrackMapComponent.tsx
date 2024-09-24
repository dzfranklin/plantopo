'use client';

import Skeleton from '@/components/Skeleton';
import { useEffect, useRef, useState } from 'react';
import * as ml from 'mapbox-gl';
import { MAPBOX_TOKEN } from '@/env';
import { bbox as computeBBox } from '@turf/bbox';
import 'mapbox-gl/dist/mapbox-gl.css';
import { useSettings } from '@/features/settings/useSettings';
import { featureCollection, lineString } from '@turf/helpers';

export default function TrackMapComponent({
  line,
}: {
  line: [number, number][];
}) {
  const [showSkeleton, setShowSkeleton] = useState(true);

  const ref = useRef<HTMLDivElement>(null);

  const { units } = useSettings();
  const initialUnits = useRef(units);
  const scaleRef = useRef<ml.ScaleControl | null>(null);
  useEffect(() => {
    initialUnits.current = units;
  }, [units]);

  const initialLine = useRef(line);
  useEffect(() => {
    initialLine.current = line;
  }, [line]);

  const mapRef = useRef<ml.Map | null>(null);

  useEffect(() => {
    if (!ref.current) return;
    const el = ref.current;

    setShowSkeleton(false);

    const map = new ml.Map({
      container: el,
      accessToken: MAPBOX_TOKEN,
      style: 'mapbox://styles/dzfranklin/clxlno49r00er01qq3ppk4wwo',
      logoPosition: 'top-right',
    });

    const observer = new ResizeObserver(() => {
      map.resize();
    });
    observer.observe(el);

    map.on('style.load', () => {
      mapRef.current = map;

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
        data: { type: 'FeatureCollection', features: [] },
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

      setTrack(map, initialLine.current);
    });

    return () => {
      observer.disconnect();
      map.remove();
    };
  }, []);

  useEffect(() => {
    if (!mapRef.current) return;
    setTrack(mapRef.current, line);
  }, [line]);

  useEffect(() => {
    if (!scaleRef.current) return;
    if (units === 'customary') {
      scaleRef.current.setUnit('imperial');
    } else {
      scaleRef.current.setUnit('metric');
    }
  }, [units]);

  return (
    <div className="h-full w-full max-h-full max-w-full relative">
      {showSkeleton && (
        <div className="absolute inset-0">
          <Skeleton />
        </div>
      )}
      <div className="absolute inset-0 overflow-clip rounded">
        <div ref={ref} className="h-full w-full max-h-full max-w-full" />
      </div>
    </div>
  );
}

function setTrack(map: ml.Map, line: [number, number][]) {
  if (line.length >= 2) {
    const geojson = lineString(line);
    const bbox = computeBBox(geojson);
    (map.getSource('track') as ml.GeoJSONSource).setData(geojson);
    map.fitBounds(bbox as ml.LngLatBoundsLike, { padding: 50, animate: false });
  } else {
    (map.getSource('track') as ml.GeoJSONSource).setData(featureCollection([]));
  }
}

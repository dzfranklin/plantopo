'use client';

import InlineAlert from '@/components/InlineAlert';
import * as Plot from '@observablehq/plot';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  elevationUnitLabel,
  elevationInUnit,
  formatUnitless,
  distanceInUnit,
  formatDistance,
  formatElevation,
} from '@/features/units/format';
import { useUnitSettings } from '@/features/units/useUnitSettings';
import Skeleton from '@/components/Skeleton';
import { distance as _computeDistance } from '@turf/distance';

function computeDistance(a: [number, number], b: [number, number]): number {
  return _computeDistance(a, b, { units: 'meters' });
}

// See <https://www.gpsvisualizer.com/tutorials/elevation_gain.html>
const horizThreshold = 5;
const vertTreshold = 5;

interface PointEntry {
  elevation: number;
  distance: number;
  coord: [number, number];
}

export default function ElevationChartComponent({
  coordinates,
  elevations,
  onMarkDistance,
}: {
  coordinates: [number, number][];
  elevations: number[];
  onMarkDistance: (distance: number | undefined) => void;
}) {
  const [isMalformed, setIsMalformed] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const [settings] = useUnitSettings();
  const [loaded, setLoaded] = useState(false);

  const onMarkDistanceRef = useRef(onMarkDistance);
  useEffect(() => {
    onMarkDistanceRef.current = onMarkDistance;
  }, [onMarkDistance]);

  const height = 200;
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    if (!ref.current) return;
    const el = ref.current;
    const obs = new ResizeObserver((entries) => {
      const rect = entries[0]!.contentRect;
      setWidth(rect.width);
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    if (!ref.current) return;
    const el = ref.current;

    if (coordinates.length === 0 || coordinates.length !== elevations.length) {
      setIsMalformed(true);
      return;
    }

    const maxElevation = Math.max(...elevations);

    const points: PointEntry[] = [];
    let distance = 0;
    for (let i = 0; i < coordinates.length; i++) {
      const coord = coordinates[i]!;
      const elevation = elevations[i]!;

      if (i > 0) {
        distance += computeDistance(coordinates[i - 1]!, coord);
      }

      const point: PointEntry = {
        elevation,
        distance,
        coord,
      };

      if (i === 0 || i === coordinates.length - 1) {
        points.push(point);
      } else if (elevation === maxElevation) {
        points.push(point);
      } else {
        const lastPoint = points[points.length - 1]!;
        const horizDelta = computeDistance(lastPoint.coord, coord);
        const vertDelta = Math.abs(elevation - lastPoint.elevation);
        if (horizDelta >= horizThreshold && vertDelta >= vertTreshold) {
          points.push(point);
        }
      }
    }

    const plot = Plot.plot({
      width,
      height,
      marginLeft: 0, // don’t need left-margin since labels are inset
      x: {
        transform: (x) => distanceInUnit(x, settings.distance),
      },
      y: {
        domain: [
          elevationInUnit(
            Math.min(...points.map((p) => p.elevation)),
            settings.elevation,
          ),
          elevationInUnit(
            Math.max(...points.map((p) => p.elevation)) + 100,
            settings.elevation,
          ),
        ] as const,
        transform: (y) => elevationInUnit(y, settings.elevation),
      },
      marks: [
        Plot.gridY({
          strokeOpacity: 0.1,
        }),
        Plot.gridX({
          strokeOpacity: 0.1,
        }),
        Plot.axisY({
          label: 'Elevation',
          tickSize: 0, // don’t draw ticks
          anchor: 'right',
          marginRight: 60, // space for five digits
          tickFormat: ((value: number, i: number, axis: number[]) => {
            let formatted = formatUnitless(value, 0);
            if (i === axis.length - 1) {
              const unit = elevationUnitLabel(settings.elevation);
              formatted += ` ${unit}`;
            }
            return formatted;
          }) as any,
        }),
        Plot.axisX({
          label: 'Distance',
          tickSize: 0, // don’t draw ticks
        }),
        Plot.areaY(points, {
          x: 'distance',
          y: 'elevation',
          fill: '#a1a1aa', // zinc-400
          fillOpacity: 0.4,
          clip: true,
        }),
        Plot.crosshairX(points, {
          x: 'distance',
          y: 'elevation',
        }),
        Plot.tip(
          points,
          Plot.pointer({
            x: 'distance',
            y: 'elevation',
            title(p: PointEntry, _i: number) {
              return [
                `Distance: ${formatDistance(p.distance, settings.distance).join(' ')}`,
                `Elevation: ${formatElevation(p.elevation, settings.elevation).join(' ')}`,
              ].join('\n\n');
            },
          }),
        ),
      ],
    });

    plot.addEventListener('input', (_evt) => {
      const value = plot.value as PointEntry | null | undefined;
      onMarkDistanceRef.current?.(value?.distance ?? undefined);
    });

    el.append(plot);
    setLoaded(true);

    return () => {
      plot.remove();
    };
  }, [coordinates, elevations, settings, width]);
  return (
    <div ref={ref} style={{ height }}>
      {!loaded && <Skeleton />}
      {isMalformed && (
        <InlineAlert variant="error">Malformed elevation data</InlineAlert>
      )}
    </div>
  );
}

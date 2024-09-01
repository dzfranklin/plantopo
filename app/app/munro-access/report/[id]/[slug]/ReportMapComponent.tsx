import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { ItineraryData, MunroList, ReportData } from './report';
import * as ml from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { MAPBOX_TOKEN } from '@/env';
import geojson, { Feature } from 'geojson';
import { decode as decodePolyline } from '@mapbox/polyline';
import { bboxPolygon as computeBBoxPolygon } from '@turf/bbox-polygon';
import { bbox as computeBBox } from '@turf/bbox';
import { buffer as computeBuffer } from '@turf/buffer';
import { itineraryHour } from './time';
import { timeColorScale } from './color';
import { distance as computeDistance } from '@turf/distance';
import { length as computeLength } from '@turf/length';
import { bezierSpline } from '@turf/bezier-spline';
import { lineString } from '@turf/helpers';

const arcCutoffKm = 30;

export function ReportMapComponent({
  report,
  munros,
  expandedCluster,
}: {
  report: ReportData;
  munros: MunroList;
  expandedCluster: number | null;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<ml.Map | null>(null);

  const expandedClusterRef = useRef<number | null>(null);
  useEffect(() => {
    expandedClusterRef.current = expandedCluster;
  }, [expandedCluster]);

  const reportFeature = useMemo(() => reportToGeoJSON(report), [report]);

  useLayoutEffect(() => {
    if (!ref.current) return;
    const el = ref.current;

    let loaded = false;
    let isSticky = false;

    const mapEl = document.createElement('div');
    mapEl.style.width = '100%';
    mapEl.style.height = '100%';
    el.append(mapEl);

    const map = new ml.Map({
      container: mapEl,
      accessToken: MAPBOX_TOKEN,
      style: 'mapbox://styles/dzfranklin/clxlno49r00er01qq3ppk4wwo',
    });
    mapRef.current = map;

    const sizeEl = () => {
      const doc = document.documentElement;
      const rect = el.getBoundingClientRect();
      if (!isSticky) {
        el.style.width = rect.width + 'px';
        el.style.height = doc.clientHeight - rect.top - 40 + 'px';
      }

      if (loaded) {
        try {
          map.resize();
        } catch (err) {
          console.warn('failed to resize', err);
        }
      }
    };

    const resizeObs = new ResizeObserver(() => {
      // Note that ResizeObserver doesn't monitor top so the rect it calls us
      // with is useless
      sizeEl();
    });
    resizeObs.observe(el.parentElement!);

    let scrollRAF: number | null = null;
    window.addEventListener('scroll', () => {
      if (scrollRAF !== null) cancelAnimationFrame(scrollRAF);
      scrollRAF = requestAnimationFrame(() => {
        const rect = el.getBoundingClientRect();
        isSticky = rect.top <= 40;
      });
    });

    window.addEventListener('resize', () => sizeEl());
    sizeEl();

    map.on('load', () => {
      loaded = true;
      map.resize();

      const reportBBox = computeBBoxPolygon(computeBBox(reportFeature));
      const boundsFeature = computeBuffer(reportBBox, 20, {
        units: 'kilometers',
      })!;
      const bbox = computeBBox(boundsFeature);
      map.fitBounds([bbox[0], bbox[1], bbox[2], bbox[3]], { animate: false });
      map.setMaxBounds(map.getBounds()!);

      map.addSource('report', {
        type: 'geojson',
        data: updateReportGeoJSON(reportFeature, expandedClusterRef.current),
      });

      map.addSource('munros', {
        type: 'geojson',
        data: munros,
      });

      map.removeLayer('natural-point-label');

      for (const layer of reportLayers) {
        map.addLayer(layer);
      }

      map.addControl(new ml.ScaleControl({ unit: 'metric' }));
    });

    return () => {
      resizeObs.disconnect();
      map.remove();
      mapEl.remove();
    };
  }, [report, munros, reportFeature]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const reportSrc = map.getSource('report');
    if (!reportSrc) return;
    if (reportSrc.type !== 'geojson') throw new Error('unreachable');
    reportSrc.setData(updateReportGeoJSON(reportFeature, expandedCluster));
  }, [report, expandedCluster, reportFeature]);

  return (
    <div
      className="lg:sticky lg:top-[40px] max-w-full max-h-full overflow-hidden"
      ref={ref}
    ></div>
  );
}

// prettier-ignore
const lineColorDef: ml.ExpressionSpecification = [
  'match',
  ['get', 'itineraryHour'],
  ...Object.entries(timeColorScale).flatMap(([h, c]) => [
    Number.parseInt(h),
    c,
  ]),
  '#FFF',
];

// prettier-ignore
const reportLayers: ml.LayerSpecification[] = [
  {
    id: 'leg-line',
    type: 'line',
    source: 'report',
    filter: [
      'all',
      ['!=', ['get', 'expanded'], false],
      ['==', ['get', 'type'], 'leg'],
      ['!=', ['get', 'mode'], 'WALK'],
      ['!=', ['get', 'duplicate'], true],
    ],
    paint: {
      'line-color': lineColorDef,
      'line-width': ['case', ['get', 'expanded'], 2, 1],
    },
  },
  {
    id: 'leg-line-walk',
    type: 'line',
    source: 'report',
    filter: [
      'all',
      ['!=', ['get', 'expanded'], false],
      ['==', ['get', 'type'], 'leg'],
      ['==', ['get', 'mode'], 'WALK'],
      ['!=', ['get', 'duplicate'], true],
    ],
    paint: {
      'line-color': lineColorDef,
      'line-width': ['case', ['get', 'expanded'], 2, 1],
      'line-dasharray': [1, 2],
    },
  },
  {
    id: 'leg-dir',
    type: 'symbol',
    source: 'report',
    filter: [
      'all',
      ['!=', ['get', 'expanded'], false],
      ['==', ['get', 'type'], 'leg'],
      ['in', ['get', 'mode'], ['literal', ['BUS', 'RAIL']]],
      ['!=', ['get', 'duplicate'], true],
    ],
    layout: {
      'symbol-placement': 'line',
      'icon-image': [
        'match',
        ['get', 'mode'],
        'BUS',
        'bus',
        'RAIL',
        'rail',
        '',
      ],
      'icon-rotate': 90,
      'icon-rotation-alignment': 'map',
      'icon-size': ['interpolate', ['linear'], ['zoom'], 7, 1, 10, 1.5],
    },
  },
  {
    id: 'from',
    type: 'circle',
    source: 'report',
    filter: ['==', ['get', 'type'], 'from'],
    paint: {
      'circle-color': '#FFF',
      'circle-radius': 2.5,
      'circle-stroke-color': '#475569',
      'circle-stroke-width': 1.5,
    },
  },
  {
    id: 'to',
    type: 'circle',
    source: 'report',
    filter: [
      'all',
      ['!=', ['get', 'expanded'], false],
      ['==', ['get', 'type'], 'to'],
      ['==', ['get', 'reachable'], true],
    ],
    paint: {
      'circle-color': '#FFF',
      'circle-radius': ['interpolate', ['linear'], ['zoom'], 7, 2, 11, 4],
      'circle-stroke-color': '#475569',
      'circle-stroke-width': 1,
    },
  },
  {
    id: 'munro-label',
    type: 'symbol',
    source: 'munros',
    filter: ['>', ['zoom'], 8],
    layout: {
      'text-field': [
        'step',
        ['zoom'],
        ['get', 'name'],
        10,
        ['concat', ['get', 'name'], ' (', ['get', 'meters'], 'm)'],
      ],
      'text-optional': true,
      'text-anchor': 'top',
      'text-size': 12,
      'text-offset': [0, 0.4],
    },
  },
  {
    id: 'munro-icon',
    type: 'symbol',
    source: 'munros',
    layout: {
      'icon-image': 'mountain',
      'icon-size': ['interpolate', ['linear'], ['zoom'], 7, 0.7, 11, 1.3],
      'icon-allow-overlap': true,
      'icon-anchor': 'bottom',
    },
  },
];

function updateReportGeoJSON(
  report: geojson.FeatureCollection,
  expandedCluster: number | null,
): geojson.FeatureCollection {
  return {
    ...report,
    features: report.features.map((f) => {
      let expanded: boolean | null = null;
      if (
        expandedCluster !== null &&
        f.properties &&
        'cluster' in f.properties
      ) {
        const cluster = f.properties.cluster as number;
        expanded = cluster === expandedCluster;
      }

      return { ...f, properties: { ...f.properties, expanded } };
    }),
  };
}

function reportToGeoJSON(report: ReportData): geojson.FeatureCollection {
  const points: geojson.Feature<geojson.Point>[] = [];
  const lines: geojson.Feature<geojson.LineString>[] = [];

  points.push({
    type: 'Feature',
    geometry: {
      type: 'Point',
      coordinates: report.from,
    },
    properties: {
      type: 'from',
    },
  });

  for (const cluster of report.clusters) {
    let reachable = false;

    for (const [dir, journeys] of [
      ['out', cluster.journeys.out],
      ['back', cluster.journeys.back],
    ] as const) {
      if (!reachable && journeys.itineraries.length > 0) {
        reachable = true;
      }

      for (const itinerary of journeys.itineraries) {
        for (const leg of itineraryToGeoJSON(cluster.to.id, dir, itinerary)) {
          if (computeLength(leg, { units: 'kilometers' }) > arcCutoffKm) {
            const f: geojson.Feature<geojson.LineString> = {
              ...leg,
              geometry: { type: 'LineString', coordinates: [] },
            };

            for (let i = 0; i < leg.geometry.coordinates.length - 1; i++) {
              const start = leg.geometry.coordinates[i]! as [number, number];
              const end = leg.geometry.coordinates[i + 1]! as [number, number];
              if (
                computeDistance(start, end, { units: 'kilometers' }) >
                arcCutoffKm
              ) {
                const arc = arcBetween(start, end);
                f.geometry.coordinates.push(end);
                f.geometry.coordinates.push(...arc.geometry.coordinates);
                f.geometry.coordinates.push(start);
              } else {
                f.geometry.coordinates.push(start);
                f.geometry.coordinates.push(end);
              }
            }

            lines.push(f);
          } else {
            lines.push(leg);
          }
        }
      }
    }

    points.push({
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: cluster.to.point,
      },
      properties: {
        type: 'to',
        reachable,
        cluster: cluster.to.id,
      },
    });
  }

  return {
    type: 'FeatureCollection',
    features: (points as geojson.Feature[]).concat(lines),
  };
}

const itineraryToGeoJSON = (
  cluster: number,
  dir: 'out' | 'back',
  itinerary: ItineraryData,
): Feature<geojson.LineString>[] =>
  itinerary.legs.map((leg) => ({
    type: 'Feature',
    geometry: decodeLegGeometry(leg.legGeometry.points),
    properties: {
      type: 'leg',
      dir,
      mode: leg.mode,
      cluster,
      itineraryHour: itineraryHour(itinerary),
    },
  }));

const decodeLegGeometry = (lineString: string): geojson.LineString => ({
  type: 'LineString',
  coordinates: decodePolyline(lineString).map(([lat, lng]) => [lng, lat]),
});

function arcBetween(start: [number, number], end: [number, number]) {
  // From <https://github.com/Turfjs/turf/issues/2591>

  // Calculate the midpoint
  const midpoint = [(start[0] + end[0]) / 2, (start[1] + end[1]) / 2] as const;

  // Calculate the vector between start and end points
  const lineVector = [end[0] - start[0], end[1] - start[1]] as const;

  // Calculate the perpendicular vector
  const perpendicularVector = [-lineVector[1], lineVector[0]] as const;

  // Normalize the perpendicular vector
  const length = Math.sqrt(
    perpendicularVector[0] ** 2 + perpendicularVector[1] ** 2,
  );
  const normalizedPerpendicularVector = [
    length === 0 ? 0 : perpendicularVector[0] / length,
    length === 0 ? 0 : perpendicularVector[1] / length,
  ] as const;

  // Scale the perpendicular vector to move the midpoint (adjust the scale factor as needed)
  const scale = Math.random() * 0.05 + 0.05; // Adjust this scale factor as needed
  const midAdjusted = [
    midpoint[0] + scale * normalizedPerpendicularVector[0],
    midpoint[1] + scale * normalizedPerpendicularVector[1],
  ];

  const line = lineString([start, midAdjusted, end]);

  return bezierSpline(line, { resolution: 10000 });
}

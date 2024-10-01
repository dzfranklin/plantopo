import {
  Dispatch,
  SetStateAction,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
} from 'react';
import { ItineraryData, MunroList, ReportData } from './report';
import * as ml from 'maplibre-gl';
import geojson, { Feature, GeoJSON } from 'geojson';
import { decode as decodePolyline } from '@mapbox/polyline';
import { itineraryHour } from './time';
import { timeColorScale } from './color';
import { distance as computeDistance } from '@turf/distance';
import { length as computeLength } from '@turf/length';
import { bezierSpline } from '@turf/bezier-spline';
import { lineString } from '@turf/helpers';
import { MapComponent } from '@/features/map/MapComponent';

const arcCutoffKm = 30;
const bounds: ml.LngLatBoundsLike = [
  [-9.094, 55.572],
  [0.706, 58.606],
];

export function ReportMapComponent({
  report,
  munros,
  expandedCluster,
  setExpandedCluster,
}: {
  report: ReportData;
  munros: MunroList;
  expandedCluster: number | null;
  setExpandedCluster: Dispatch<SetStateAction<number | null>>;
}) {
  const ref = useRef<HTMLDivElement>(null);

  const munrosRef = useRef<MunroList>(munros);
  munrosRef.current = munros;

  const setExpandedClusterRef =
    useRef<Dispatch<SetStateAction<number | null>>>(setExpandedCluster);
  setExpandedClusterRef.current = setExpandedCluster;

  useLayoutEffect(() => {
    if (!ref.current) return;
    const el = ref.current;

    let isSticky = false;

    const sizeEl = () => {
      const doc = document.documentElement;
      const rect = el.getBoundingClientRect();
      if (!isSticky) {
        el.style.width = rect.width + 'px';
        el.style.height = doc.clientHeight - rect.top - 40 + 'px';
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

    return () => {
      resizeObs.disconnect();
    };
  }, []);

  const reportData = useMemo(() => {
    const reportFeature = reportToGeoJSON(report);
    return updateReportGeoJSON(reportFeature, expandedCluster);
  }, [expandedCluster, report]);
  const reportDataRef = useRef<GeoJSON>(reportData);
  reportDataRef.current = reportData;

  const mapRef = useRef<ml.Map | null>(null);

  const onMap = useCallback((map: ml.Map) => {
    mapRef.current = map;

    map.addSource('report', {
      type: 'geojson',
      data: reportDataRef.current,
    });

    map.addSource('munros', {
      type: 'geojson',
      data: munrosRef.current,
    });

    if (map.getLayer('Peak labels')) {
      map.removeLayer('Peak labels');
    }

    for (const layer of reportLayers) {
      map.addLayer(layer);
    }

    let hoveredPolygonId: number | null = null;
    map.on('mousemove', 'to', (e) => {
      if (e.features && e.features.length > 0) {
        if (hoveredPolygonId !== null) {
          map.setFeatureState(
            { source: 'report', id: hoveredPolygonId },
            { hover: false },
          );
        }

        const f = e.features[0]!;
        hoveredPolygonId = f.id as number;
        map.setFeatureState(
          { source: 'report', id: hoveredPolygonId },
          { hover: true },
        );
        map.getCanvas().style.cursor = 'pointer';
      }
    });
    map.on('mouseleave', 'to', () => {
      if (hoveredPolygonId !== null) {
        map.setFeatureState(
          { source: 'report', id: hoveredPolygonId },
          { hover: false },
        );
      }
      hoveredPolygonId = null;
      map.getCanvas().style.cursor = '';
    });
    map.on('click', 'to', (e) => {
      const f = e?.features?.[0];
      if (!f) return;
      const cluster = f.properties!.cluster as number;
      setExpandedClusterRef.current(cluster);
    });

    return () => {
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const reportSrc = map.getSource('report');
    if (!reportSrc) return;
    (reportSrc as ml.GeoJSONSource).setData(reportData);
  }, [reportData]);

  return (
    <div className="lg:sticky lg:top-[40px] overflow-hidden" ref={ref}>
      <MapComponent onMap={onMap} initialBounds={bounds} maxBounds={bounds} />
    </div>
  );
}

// prettier-ignore
// @ts-expect-error the object.entries returns in the correct order
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
        '/sprites/bus@2x.png',
        'RAIL',
        '/sprites/rail@2x.png',
        '',
      ],
      'icon-rotate': 90,
      'icon-rotation-alignment': 'map',
      'icon-size': ['interpolate', ['linear'], ['zoom'], 7, 0.6, 10, 1],
    },
    paint: {
      'icon-color': 'rgb(30 64 175)',
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
      'circle-radius': [
        'interpolate',
        ['linear'],
        ['zoom'],
        7,
        ['case', ['boolean', ['feature-state', 'hover'], false], 4.5, 3],
        11,
        ['case', ['boolean', ['feature-state', 'hover'], false], 7.5, 5],
      ],
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
      'icon-image': '/sprites/triangle@2x.png',
      'icon-size': ['interpolate', ['linear'], ['zoom'], 7, 0.5, 11, 1],
      'icon-allow-overlap': true,
      'icon-ignore-placement': true,
      'icon-anchor': 'bottom',
    },
    paint: {
      'icon-color': '#60351b',
      'icon-halo-color': '#FFFFFF',
      'icon-halo-width': 1,
      'icon-halo-blur': 2,
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

  const idRef = { id: 0 };
  const nextID = () => ++idRef.id;

  points.push({
    type: 'Feature',
    id: nextID(),
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
        for (const leg of itineraryToGeoJSON(
          cluster.to.id,
          dir,
          itinerary,
          nextID,
        )) {
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

    if (
      cluster.journeys.out.itineraries.length > 0 ||
      cluster.journeys.back.itineraries.length > 0
    ) {
      points.push({
        type: 'Feature',
        id: nextID(),
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
  nextID: () => number,
): Feature<geojson.LineString>[] =>
  itinerary.legs.map((leg) => ({
    type: 'Feature',
    id: nextID(),
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

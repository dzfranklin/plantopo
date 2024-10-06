'use client';

import { MapComponent } from '@/features/map/MapComponent';
import { feature, featureCollection } from '@turf/helpers';
import * as ml from 'maplibre-gl';
import { HighwayGraph, HighwaySegment } from '@/features/map/snap/HighwayGraph';
import { mapBBox } from '@/features/map/util';
import { Feature } from 'geojson';
import { aStarPathSearch } from '@/features/map/snap/aStar';

const sourceID = 'debug-snapgraph-node-to-node';

export default function Page() {
  return (
    <MapComponent
      onMap={(m) => {
        // TODO: get from context
        const g = new HighwayGraph(
          'https://plantopo-storage.b-cdn.net/highway-graph/',
        );

        m.addSource(sourceID, { type: 'geojson', data: featureCollection([]) });
        const s = m.getSource(sourceID) as ml.GeoJSONSource;

        layers.forEach((l) => m.addLayer(l));

        let abortPrevUpdate: () => void | undefined;
        const updateGraph = () => {
          abortPrevUpdate?.();
          if (m.getZoom() > 11) {
            abortPrevUpdate = g.load(mapBBox(m));
          }
        };

        updateGraph();
        m.on('moveend', () => {
          updateGraph();
        });

        let start: HighwaySegment | undefined;
        let end: HighwaySegment | undefined;
        let path: HighwaySegment[] | null | undefined;

        const update = () => {
          const fc: Feature[] = [];

          if (start && end) {
            path = aStarPathSearch(g, start, end, 10_000);
          }

          if (path) {
            fc.push(...path.map((s) => s.feature));
          } else {
            if (start) {
              fc.push(feature(start.geometry, { type: 'start' }));
            }
            if (end) {
              fc.push(feature(end.geometry, { type: 'end' }));
            }
          }

          s.setData(featureCollection(fc));
        };

        m.on('click', (evt) => {
          if (evt.originalEvent.altKey) return;
          const { lng, lat } = evt.lngLat;
          const hit = g.findCloseTo([lng, lat]);

          if (path !== undefined) {
            path = undefined;
            start = undefined;
            end = undefined;
          }

          if (!start) {
            start = hit;
          } else {
            end = hit;
          }
          update();
        });
      }}
    />
  );
}

const layers: ml.LayerSpecification[] = [
  {
    id: sourceID + 'line',
    source: sourceID,
    type: 'line',
    paint: {
      'line-width': 4,
      // prettier-ignore
      'line-color': ['match', ['get', 'type'],
        'start', 'green',
        'end', 'red',
        'orange',
      ],
    },
  },
];

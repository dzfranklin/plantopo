'use client';

import { MapComponent } from '@/features/map/MapComponent';
import { feature, featureCollection, point } from '@turf/helpers';
import * as ml from 'maplibre-gl';
import { mapBBox } from '@/features/map/util';
import { Feature, LineString, Position } from 'geojson';
import { useHighwayGraph } from '@/features/map/snap/provider';

const sourceID = 'debug-snapgraph-node-to-node';

export default function Page() {
  const g = useHighwayGraph();
  return (
    <MapComponent
      onMap={(m) => {
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

        let start: Position | undefined;
        let end: Position | undefined;
        let path: LineString | null | undefined;

        const update = () => {
          const fc: Feature[] = [];

          if (start && end) {
            path = g.findPath(start, end, 10_000);
          }

          if (path) {
            console.info(path);
            fc.push(feature(path));
          } else {
            if (start) {
              fc.push(point(start, { type: 'start' }));
            }
            if (end) {
              fc.push(point(end, { type: 'end' }));
            }
          }

          s.setData(featureCollection(fc));
        };

        m.on('click', (evt) => {
          if (evt.originalEvent.altKey) return;
          const { lng, lat } = evt.lngLat;

          if (path !== undefined) {
            path = undefined;
            start = undefined;
            end = undefined;
          }

          if (!start) {
            start = [lng, lat];
          } else {
            end = [lng, lat];
          }
          update();
        });
      }}
    />
  );
}

const layers: ml.LayerSpecification[] = [
  {
    id: sourceID + 'point',
    source: sourceID,
    type: 'circle',
    paint: {
      'circle-radius': 4,
      // prettier-ignore
      'circle-color': ['match', ['get', 'type'],
        'start', 'green',
        'end', 'red',
        'black',
      ],
    },
  },
  {
    id: sourceID + 'line',
    source: sourceID,
    type: 'line',
    paint: {
      'line-width': 4,
      'line-color': 'orange',
    },
  },
  {
    id: sourceID + 'arrow',
    source: sourceID,
    type: 'symbol',
    layout: {
      'symbol-placement': 'line',
      'icon-image': '/sprites/arrow@2x.png.sdf',
    },
    paint: {
      'icon-color': 'white',
    },
  },
];

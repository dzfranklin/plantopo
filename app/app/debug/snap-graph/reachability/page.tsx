'use client';

import { MapComponent } from '@/features/map/MapComponent';
import { feature, featureCollection } from '@turf/helpers';
import * as ml from 'maplibre-gl';
import { HighwayGraph, HighwaySegment } from '@/features/map/snap/HighwayGraph';
import { mapBBox } from '@/features/map/util';
import { FeatureCollection, LineString } from 'geojson';

const sourceID = 'debug-snapgraph-reachability';

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

        // let g = SnapGraph.fromRenderedFeatures(m);
        updateGraph();
        m.on('moveend', () => {
          // g = SnapGraph.fromRenderedFeatures(m);
          updateGraph();
        });

        m.on('click', (evt) => {
          if (evt.originalEvent.altKey) return;
          const { lng, lat } = evt.lngLat;
          const hit = g.findCloseTo([lng, lat]);
          if (!hit) {
            s.setData(featureCollection([]));
            return;
          }
          console.info(hit);

          const fc = featureCollection<LineString>([]);
          fc.features.push(feature(hit.geometry));
          findNeighbors(g, hit, 0, new Set([hit.id]), fc);
          s.setData(fc);

          // const reachable = g.reachable([lng, lat]);
          // if (!reachable) {
          //   alert('no fromNode');
          //   s.setData(featureCollection([]));
          //   return;
          // }
          // s.setData(featureCollection(reachable));
        });
      }}
    />
  );
}

const maxDepth = 6;

function findNeighbors(
  g: HighwayGraph,
  from: HighwaySegment,
  depth: number,
  seen: Set<string>,
  out: FeatureCollection<LineString>,
) {
  if (depth > maxDepth) return;
  const links = g.links.get(from.id);
  if (!links) return;
  for (const link of links) {
    if (link === from.id || seen.has(link)) continue;
    seen.add(link);
    const seg = g.segments.get(link);
    if (seg) {
      out.features.push(feature(seg.geometry));
      findNeighbors(g, seg, depth + 1, seen, out);
    }
  }
}

const layers: ml.LayerSpecification[] = [
  {
    id: sourceID + 'line',
    source: sourceID,
    type: 'line',
    paint: {
      'line-width': 4,
      'line-color': 'orange',
    },
  },
];

import * as mg from 'mapbox-gl';
import * as ml from 'maplibre-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { geophotosLayers, geophotosSource } from '@/features/geophotos/style';
import type { GeophotoSelection } from '@/features/geophotos/GeophotosComponent';
import { MapComponent } from '@/features/map/MapComponent';

type OnSelect = (bounds: GeophotoSelection) => void;

export function GeophotosMap({ onSelect }: { onSelect: OnSelect }) {
  return <MapComponent onMap={(map) => setupMap(map, onSelect)} />;
}

function setupMap(map: ml.Map, onSelect: OnSelect) {
  map.addSource('geophotos', geophotosSource);
  geophotosLayers.forEach((l) => map.addLayer(l));

  map.on('click', (e) => {
    const bbox: [mg.PointLike, mg.PointLike] = [
      [e.point.x - 10, e.point.y - 10],
      [e.point.x + 10, e.point.y + 10],
    ];

    const queried = map.queryRenderedFeatures(bbox, { layers: ['geophoto'] });

    const pointA = map.unproject(bbox[0]);
    const pointB = map.unproject(bbox[1]);

    onSelect({
      ids: queried
        .slice(0, Math.min(queried.length, 25))
        .map((f) => f.id as number),
      minLng: Math.min(pointA.lng, pointB.lng),
      minLat: Math.min(pointA.lat, pointB.lat),
      maxLng: Math.max(pointA.lng, pointB.lng),
      maxLat: Math.max(pointA.lat, pointB.lat),
    });
  });
}

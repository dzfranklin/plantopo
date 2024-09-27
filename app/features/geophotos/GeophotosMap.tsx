import { useEffect, useRef } from 'react';
import * as ml from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { MAPBOX_TOKEN } from '@/env';
import { geophotosLayers, geophotosSource } from '@/features/geophotos/style';
import type { GeophotoSelection } from '@/features/geophotos/GeophotosComponent';

type OnSelect = (bounds: GeophotoSelection) => void;

export function GeophotosMap({ onSelect }: { onSelect: OnSelect }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!ref.current) return;

    const map = new ml.Map({
      container: ref.current,
      accessToken: MAPBOX_TOKEN,
      style: 'mapbox://styles/dzfranklin/clxlno49r00er01qq3ppk4wwo',
      center: [0, 51],
      zoom: 2,
      logoPosition: 'top-right',
      hash: true,
    });

    loadMap(map, onSelect).catch((err) => {
      throw err;
    });

    return () => map.remove();
  }, [onSelect]);
  return <div className="w-full h-full" ref={ref}></div>;
}

async function loadMap(map: ml.Map, onSelect: OnSelect): Promise<void> {
  const [markerImage, _] = await Promise.all([
    loadImage(map, '/marker@2x.png'),
    awaitStyleLoad(map),
  ]);

  map.addImage('pmarker', markerImage, { sdf: true, pixelRatio: 2 });

  map.addSource('geophotos', geophotosSource);
  geophotosLayers.forEach((l) => map.addLayer(l));

  map.on('click', (e) => {
    const bbox: [ml.PointLike, ml.PointLike] = [
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

function awaitStyleLoad(map: ml.Map): Promise<void> {
  return new Promise((resolve) => map.on('style.load', () => resolve()));
}

function loadImage(
  map: ml.Map,
  url: string,
): Promise<ImageBitmap | HTMLImageElement | ImageData> {
  return new Promise((resolve, reject) => {
    map.loadImage(url, (err, res) => {
      if (err) {
        reject(err);
      } else {
        resolve(res!);
      }
    });
  });
}

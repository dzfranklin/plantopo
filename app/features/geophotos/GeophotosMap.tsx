import { useEffect, useRef } from 'react';
import * as ml from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { API_ENDPOINT, MAPBOX_TOKEN } from '@/env';

export function GeophotosMap({
  onSelect,
}: {
  onSelect: (ids: number[]) => void;
}) {
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
    });

    map.on('style.load', () => {
      map.loadImage('/marker.png', (error, image) => {
        if (error) throw error;
        map.addImage('pmarker', image as any, { sdf: true, pixelRatio: 2 });

        map.addSource('geophotos', {
          type: 'vector',
          tiles: [API_ENDPOINT + 'geophotos/tile/{z}/{x}/{y}.mvt.gz'],
          minzoom: 9,
          maxZoom: 16,
        });

        // prettier-ignore
        map.addLayer({
          id: 'geophoto',
          type: 'symbol',
          source: 'geophotos',
          'source-layer': 'default',
          filter: ['>=', ['zoom'], 9],
          layout: {
            'icon-image': 'pmarker',
            'icon-size': [
              'interpolate',
              ['linear'],
              ['zoom'],
              11,
              0.25,
              15,
              0.5,
              20,
              1,
            ],
            'icon-padding': 0,
            'icon-allow-overlap': true,
            'icon-ignore-placement': true,
          },
          paint: {
            'icon-color': [
              'case',
              ['coalesce', ['feature-state', 'selected'], false],
              '#7c3aed',
              '#3b82f6',
            ],
          },
        });

        map.on('zoom', () => {
          // TODO: show message to zoom in
        });

        let selected: number[] = [];
        map.on('click', (e) => {
          const bbox: [ml.PointLike, ml.PointLike] = [
            [e.point.x - 5, e.point.y - 5],
            [e.point.x + 5, e.point.y + 5],
          ];
          let fs = map.queryRenderedFeatures(bbox, { layers: ['geophoto'] });
          fs = fs.slice(0, Math.min(fs.length, 25));

          for (const f of selected) {
            map.setFeatureState(
              { source: 'geophotos', sourceLayer: 'default', id: f },
              { selected: false },
            );
          }

          for (const f of fs) {
            map.setFeatureState(f, { selected: true });
          }
          selected = fs.map((f) => f.id as number);
          onSelect(selected);
        });
      });
    });
  }, [onSelect]);
  return <div className="w-full h-full" ref={ref}></div>;
}

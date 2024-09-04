'use client';

import { useEffect, useRef } from 'react';
import * as ml from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { API_ENDPOINT, MAPBOX_TOKEN } from '@/env';

export function GeophotosMap() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!ref.current) return;

    const map = new ml.Map({
      container: ref.current,
      accessToken: MAPBOX_TOKEN,
      style: 'mapbox://styles/dzfranklin/clxlno49r00er01qq3ppk4wwo',
      center: [0, 0],
      zoom: 6,
    });

    map.on('style.load', () => {
      map.loadImage('/geophotos/icon.png', (error, image) => {
        if (error) throw error;
        map.addImage('geophoto', image as any, { pixelRatio: 2 });

        map.addSource('geophotos', {
          type: 'vector',
          tiles: [API_ENDPOINT + 'geophotos/tile/{z}/{x}/{y}.mvt.gz'],
          minzoom: 6,
          maxZoom: 10,
        });

        map.addLayer({
          id: 'geophoto',
          type: 'symbol',
          source: 'geophotos',
          'source-layer': 'default',
          layout: {
            'icon-image': 'geophoto',
            'icon-size': ['interpolate', ['linear'], ['zoom'], 6, 0.5, 11, 1],
            'icon-allow-overlap': true,
          },
        });

        map.on('click', 'geophoto', (evt) => {
          // TODO: set to the currently loading images. fire an http request to load. show in sidebar. window so that only a few are rendered at once to reduce load amplification
          console.log(evt.features);
        });
      });
    });
  }, []);
  return <div className="w-full h-full" ref={ref}></div>;
}

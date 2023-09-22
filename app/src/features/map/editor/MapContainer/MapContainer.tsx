import 'maplibre-gl/dist/maplibre-gl.css';
import '@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css';
import './MapContainer.css';
import { useEffect, useRef, useState } from 'react';
import * as ml from 'maplibre-gl';
import { TokenValues, useTokensQuery } from '../../api/useTokens';
import { RenderStack } from './RenderStack';

const GLYPH_URL = 'https://api.maptiler.com/fonts/{fontstack}/{range}.pbf';

/**
 * This should not run on every render. Things that update
 * frequently go in MapRenderStack
 */

export function MapContainer() {
  const { data: tokens } = useTokensQuery();
  const containerRef = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<ml.Map | null>(null);

  // CREATE
  useEffect(() => {
    if (!containerRef.current) return;

    const map = new ml.Map({
      container: containerRef.current,
      style: {
        version: 8,
        sources: {},
        layers: [],
        glyphs: GLYPH_URL,
      },
      keyboard: true,
      attributionControl: false, // So that we can implement our own
      interactive: true,
    });
    setMap(map);
    console.log('Created map', map);

    map.addControl(new ml.NavigationControl());

    return () => {
      map.remove();
    };
  }, []);

  // PROVIDE AUTH TOKENS
  useEffect(() => {
    if (!tokens || !map) return;
    map.setTransformRequest((url) => ({ url: transformUrl(url, tokens) }));
    () => map.setTransformRequest((url) => ({ url }));
  }, [map, tokens]);

  return (
    <div ref={containerRef} className="relative w-full h-full">
      <RenderStack map={map} containerRef={containerRef} />
    </div>
  );
}

function transformUrl(url: string, tokens: TokenValues): string {
  {
    let query = '';
    if (url.startsWith('https://api.mapbox.com')) {
      query = 'access_token=' + tokens.mapbox;
    } else if (url.startsWith('https://api.os.uk')) {
      query = 'srs=3857&key=' + tokens.os;
    } else if (url.startsWith('https://api.maptiler.com')) {
      query = 'key=' + tokens.maptiler;
    }

    if (url.includes('?')) {
      return url + '&' + query;
    } else {
      return url + '?' + query;
    }
  }
}

import 'maplibre-gl/dist/maplibre-gl.css';
import '@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css';
import './MapContainer.css';
import { useEffect, useRef, useState } from 'react';
import { LayersControl } from './LayersControl';
import { AttributionControl } from './attributionControl/AttributionControl';
import { ProgressBar, ProgressCircle } from '@adobe/react-spectrum';
import { useSync } from '../api/useSync';
import { useMapSources } from '../../api/useMapSources';
import * as ml from 'maplibre-gl';
import { useScene } from '../api/useScene';
import { LayerRenderer } from './LayerRenderer';
import { TokenValues, useTokens } from '../../api/useTokens';
import { InteractionManager } from './InteractionManager/InteractionManager';
import { CurrentCameraPosition } from '../CurrentCamera';
import { FeatureRenderer } from './FeatureRenderer';
import { FeaturePainter } from './FeaturePainter';

const GLYPH_URL = 'https://api.maptiler.com/fonts/{fontstack}/{range}.pbf';

// If you see the stuff we paint flickering this function may be too slow.

export function MapContainer() {
  const { data: sources } = useMapSources();
  const { data: tokens } = useTokens();
  const { engine } = useSync();
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<ml.Map | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isLoading, setIsLoading] = useState(false);

  const updateSize = (contentRect: DOMRectReadOnly) => {
    const canvas = canvasRef.current;
    const map = mapRef.current;
    if (!canvas || !map) return;

    const dpi = window.devicePixelRatio || 1;

    canvas.width = contentRect.width * dpi;
    canvas.height = contentRect.height * dpi;
    canvas.style.width = contentRect.width + 'px';
    canvas.style.height = contentRect.height + 'px';

    // Prevent multiple copies of the same position which our painter doesn't
    // support. From <https://github.com/mapbox/mapbox-gl-js/issues/6529>
    const MAGIC_MINZOOM_COEFFICIENT = 984.615384615;
    map.setMinZoom(contentRect.width / MAGIC_MINZOOM_COEFFICIENT);

    map.triggerRepaint();
  };

  // CREATE
  useEffect(() => {
    if (
      !containerRef.current ||
      !canvasRef.current ||
      !engine ||
      !sources ||
      !tokens
    ) {
      return;
    }

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
      transformRequest: (url: string) => ({ url: transformUrl(url, tokens) }),
    });
    map.addControl(new ml.NavigationControl());
    mapRef.current = map;
    console.log('Created map', map);

    const featureRenderer = new FeatureRenderer();
    const featurePainter = new FeaturePainter(canvasRef.current);
    const interactionManager = new InteractionManager(map, engine);
    let layerRenderer: LayerRenderer | null = null;

    updateSize(containerRef.current.getBoundingClientRect());

    map.once('style.load', () => {
      layerRenderer = new LayerRenderer(map, sources);
    });

    map.on('data', () => setIsLoading(!map.areTilesLoaded()));

    // RENDER ourselves right when maplibre renders
    map.on('render', () => {
      const camera = CurrentCameraPosition.fromMap(map);
      const scene = engine.render();
      layerRenderer?.render(scene);
      const renderList = featureRenderer.render(scene, camera);
      featurePainter.paint(camera, renderList);
      interactionManager.register(renderList);
    });

    return () => {
      map.remove();
    };
  }, [sources, engine, tokens]);

  const sidebarWidth = useScene((s) => s.sidebarWidth);

  // SIZE/RESIZE
  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]; // We only observe one element
      if (!entry) return;
      updateSize(entry.contentRect);
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // REQUEST RE-RENDER when our scene changes
  const scene = useScene((s) => s);
  useEffect(() => {
    mapRef.current?.triggerRepaint();
  }, [scene]);

  return (
    <div ref={containerRef} className="relative w-full h-full touch-none">
      <div className="absolute z-20 flex justify-end pointer-events-none bottom-[1px] right-[1px]">
        <ProgressBar
          isIndeterminate
          isHidden={!isLoading}
          size="S"
          aria-label="map loading"
        />
      </div>

      {(!engine || !tokens) && (
        <div
          className="absolute top-0 bottom-0 right-0 z-50 grid place-items-center"
          style={{ left: `${sidebarWidth}px` }}
        >
          <div>
            <ProgressCircle isIndeterminate aria-label="loading" size="L" />
            <h1 className="mt-4 text-center">Opening map</h1>
          </div>
        </div>
      )}

      {engine && (
        <>
          <LayersControl engine={engine} />
          <AttributionControl sidebarWidth={sidebarWidth} />
        </>
      )}

      <canvas ref={canvasRef} className="absolute z-10 pointer-events-none" />
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

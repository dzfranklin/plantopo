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
import { SceneLayer } from '../api/SyncEngine/Scene';
import { MapSources } from '../api/mapSources';
import { CameraPosition } from '../CameraPosition';
import { LayerRenderer } from './LayerRenderer';
import { TokenValues, useTokens } from '../../api/useTokens';

const GLYPH_URL = 'https://api.maptiler.com/fonts/{fontstack}/{range}.pbf';

export function MapContainer({
  sidebarWidth,
  initialCamera,
  saveCamera,
}: {
  sidebarWidth: number;
  initialCamera: CameraPosition;
  saveCamera: (_: CameraPosition) => void;
}) {
  const { data: sources } = useMapSources();
  const { data: tokens } = useTokens();
  const { engine } = useSync();
  const containerRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Synchronize refs so we can access in CREATE
  const sidebarWidthRef = useRef<number>(sidebarWidth);
  useEffect(() => {
    sidebarWidthRef.current = sidebarWidth;
  }, [sidebarWidth]);
  const initialCameraRef = useRef(initialCamera);
  useEffect(() => {
    initialCameraRef.current = initialCamera;
  }, [initialCamera]);

  const [lRenderer, setLRenderer] = useState<LayerRenderer | null>(null);

  // CREATE
  useEffect(() => {
    if (!containerRef.current || !engine || !sources || !tokens) return;
    const initialCamera = initialCameraRef.current;
    const map = new ml.Map({
      container: containerRef.current,
      style: {
        version: 8,
        sources: {},
        layers: [],
        glyphs: GLYPH_URL,
      },
      center: [initialCamera.lng, initialCamera.lat],
      pitch: initialCamera.pitch,
      bearing: initialCamera.bearing,
      zoom: initialCamera.zoom,
      keyboard: true,
      attributionControl: false, // So that we can implement our own
      transformRequest: (url: string) => ({ url: transformUrl(url, tokens) }),
    });

    map.once('style.load', () => {
      const lRenderer = new LayerRenderer(map, sources);
      setLRenderer(lRenderer);
    });

    map.on('data', () => setIsLoading(!map.areTilesLoaded()));

    let hasUserMove = false;
    map.on('moveend', () => {
      const center = map.getCenter();
      const camera: CameraPosition = {
        lng: center.lng,
        lat: center.lat,
        bearing: map.getBearing(),
        pitch: map.getPitch(),
        zoom: map.getZoom(),
      };

      if (hasUserMove) {
        saveCamera(camera);
      } else {
        hasUserMove =
          camera.lng > 0.001 ||
          camera.lat > 0.001 ||
          camera.bearing > 0.001 ||
          camera.pitch > 0.001 ||
          camera.zoom > 0.001;
      }
    });
    return () => {
      map.remove();
      setLRenderer(null);
    };
  }, [initialCamera, sources, engine, saveCamera, tokens]);

  const scene = useScene();

  // SYNC LAYERS
  useEffect(() => {
    if (!lRenderer) return;
    lRenderer.render(scene);
  }, [lRenderer, scene]);

  return (
    <div ref={containerRef} className="relative w-full h-full">
      <div className="absolute z-10 flex justify-end pointer-events-none bottom-[1px] right-[1px]">
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

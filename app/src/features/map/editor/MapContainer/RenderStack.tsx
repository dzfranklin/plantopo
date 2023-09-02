import 'maplibre-gl/dist/maplibre-gl.css';
import '@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css';
import './MapContainer.css';
import { RefObject, useEffect, useRef, useState } from 'react';
import { LayersControl } from './LayersControl';
import { AttributionControl } from './attributionControl/AttributionControl';
import { ProgressBar } from '@adobe/react-spectrum';
import { useEngine } from '../api/useEngine';
import { useMapSources } from '../../api/useMapSources';
import * as ml from 'maplibre-gl';
import { LayerRenderer } from './LayerRenderer';
import { InteractionManager } from './InteractionManager/InteractionManager';
import { CurrentCameraPosition } from '../CurrentCamera';
import { FeatureRenderer } from './FeatureRenderer';
import { FeaturePainter } from './FeaturePainter';
import { Scene } from '../api/SyncEngine/Scene';

// Instruct nextjs to remout this component on every edit
// @refresh reset

/** This runs on every render and should be fast. Things that don't need to be
reset that frequently belong in MapContainer. If you see the stuff we paint
flickering this function may be too slow.
*/

export function RenderStack({
  map,
  containerRef,
}: {
  map: ml.Map | null;
  containerRef: RefObject<HTMLDivElement>;
}) {
  const { data: sources } = useMapSources();
  const engine = useEngine();

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const canvasCtxRef = useRef<CanvasRenderingContext2D | null>(null);

  const [isLoadingContent, setIsLoadingContent] = useState(true);

  // ATTACH TO MAP
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    if (!map || !engine || !sources) return;

    let canvasCtx;
    if (canvasCtxRef.current) {
      canvasCtx = canvasCtxRef.current;
    } else {
      canvasCtx = canvas.getContext('2d');
      if (!canvasCtx) throw new Error('RenderStack: getContext failed');
      canvasCtxRef.current = canvasCtx;
    }

    syncSize(map, canvas, container.getBoundingClientRect());

    map.on('data', () => setIsLoadingContent(!map.areTilesLoaded()));

    const initialCamera = CurrentCameraPosition.fromMap(map);

    const featureRenderer = new FeatureRenderer();
    const featurePainter = new FeaturePainter(canvas, canvasCtx);
    const interactionManager = new InteractionManager({
      engine,
      initialCamera,
      container,
      map,
    });
    const layerRenderer = new LayerRenderer(map, sources);
    console.log('Attached RenderStack', {
      map,
      engine,
      featureRenderer,
      featurePainter,
      interactionManager,
      layerRenderer,
    });

    const renderScene = (scene: Scene) => {
      const camera = CurrentCameraPosition.fromMap(map);

      if (map.isStyleLoaded()) {
        layerRenderer.render(scene);
      }

      const renderList = featureRenderer.render(scene, camera);
      featurePainter.paint(camera, renderList);
      interactionManager.register(renderList.list, camera);
    };

    // Scene changed, camera didn't necessarily change
    const removeOnRender = engine.onRender(renderScene);
    // Camera changed, scene didn't necessarily change
    const onMapRender = () => renderScene(engine.scene);
    map.on('render', onMapRender);

    engine.render();
    map.triggerRepaint();

    return () => {
      interactionManager.remove();
      layerRenderer.remove();
      removeOnRender();
      map.off('render', onMapRender);
    };
  }, [sources, engine, containerRef, map]);

  // SIZE/RESIZE
  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]; // We only observe one element
      if (!entry || !canvasRef.current) return;
      syncSize(map, canvasRef.current, entry.contentRect);
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [containerRef, map]);

  return (
    <>
      <canvas
        ref={canvasRef}
        className="absolute z-[1] inset-0 pointer-events-none"
      />

      <div className="absolute z-[2] flex justify-end pointer-events-none bottom-[1px] right-[1px]">
        <ProgressBar
          isIndeterminate
          isHidden={!isLoadingContent}
          size="S"
          aria-label="map content loading"
        />
      </div>

      {engine && (
        <>
          <LayersControl engine={engine} />
          <AttributionControl />
        </>
      )}
    </>
  );
}

const syncSize = (
  map: ml.Map | null,
  canvas: HTMLCanvasElement,
  contentRect: DOMRectReadOnly,
) => {
  const dpi = window.devicePixelRatio || 1;

  canvas.width = contentRect.width * dpi;
  canvas.height = contentRect.height * dpi;
  canvas.style.width = contentRect.width + 'px';
  canvas.style.height = contentRect.height + 'px';

  // Prevent multiple copies of the same position which our painter doesn't
  // support. From <https://github.com/mapbox/mapbox-gl-js/issues/6529>
  const MAGIC_MINZOOM_COEFFICIENT = 984.615384615;
  map?.setMinZoom(contentRect.width / MAGIC_MINZOOM_COEFFICIENT);

  map?.resize();
  map?.triggerRepaint();
};

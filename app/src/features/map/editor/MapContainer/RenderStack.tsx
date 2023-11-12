import 'maplibre-gl/dist/maplibre-gl.css';
import '@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css';
import './MapContainer.css';
import { RefObject, useEffect, useRef, useState } from 'react';
import { LayersControl } from './LayersControl';
import { AttributionControl } from './attributionControl/AttributionControl';
import { ProgressBar } from '@adobe/react-spectrum';
import { useEngine } from '../engine/useEngine';
import * as ml from 'maplibre-gl';
import { LayerRenderer } from './LayerRenderer';
import { InteractionManager } from './InteractionManager/InteractionManager';
import { CurrentCameraPosition } from '../CurrentCamera';
import { FeatureRenderer } from './FeatureRenderer';
import { FeaturePainter } from './FeaturePainter';
import { Scene, SceneFeature } from '../engine/Scene';
import { nearestPointInGeometry } from '../nearestPointInFeature';
import booleanIntersects from '@turf/boolean-intersects';
import { MapToolbar } from './MapToolbar/MapToolbar';

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
  const engine = useEngine();

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const canvasCtxRef = useRef<CanvasRenderingContext2D | null>(null);

  const [isLoadingContent, setIsLoadingContent] = useState(true);

  // ATTACH TO MAP
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    if (!map || !engine) return;

    let suppressNotifyForNextMove = true;
    let cameraDirty = false;

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

    if (engine.initialCamera) {
      map.jumpTo(engine.initialCamera);
    }

    const featureRenderer = new FeatureRenderer();
    const featurePainter = new FeaturePainter(canvas, canvasCtx);
    const interactionManager = new InteractionManager({
      engine,
      initialCamera: CurrentCameraPosition.fromMap(map),
      container,
      map,
    });
    const layerRenderer = new LayerRenderer(map, engine.sources);
    console.log('Attached RenderStack', {
      map,
      engine,
      featureRenderer,
      featurePainter,
      interactionManager,
      layerRenderer,
    });

    let lastSelection: SceneFeature[] = [];
    let lastCamera: CurrentCameraPosition | undefined;
    const renderScene = (scene: Scene) => {
      const camera = CurrentCameraPosition.fromMap(map);
      if (!lastCamera?.equals(camera)) {
        engine.notifyCameraUpdated(camera);
      }
      lastCamera = camera;

      if (map.isStyleLoaded()) {
        layerRenderer.render(scene);
      }

      outer: for (const f of scene.features.selectedByMe) {
        for (const p of lastSelection) {
          if (p.id === f.id) continue outer;
        }

        if (!f.geometry) continue;
        const [nearestLng, nearestLat] = nearestPointInGeometry(
          camera.center,
          f.geometry,
        );

        if (!booleanIntersects(f.geometry, camera.bboxPolygon())) {
          map.flyTo({ center: [nearestLng!, nearestLat!] });
        }

        break;
      }
      lastSelection = scene.features.selectedByMe;

      // TODO: Make a little bigger
      const clipBox = camera.bboxPolygon();

      const renderList = featureRenderer.render(scene, clipBox);
      featurePainter.paint(camera, renderList);
      interactionManager.register(renderList.list, camera);
    };

    // Scene changed
    const removeOnRender = engine.addSceneSelector((s) => s, renderScene);

    // Camera changed
    const onMapRender = () => renderScene(engine.scene);
    map.on('render', onMapRender);

    const onMoveStart = () => {
      cameraDirty = true;
    };
    map.on('movestart', onMoveStart);

    const onMoveEnd = () => {
      if (suppressNotifyForNextMove) {
        suppressNotifyForNextMove = false;
      } else {
        engine.notifyCameraMoveEnd();
      }
    };
    map.on('moveend', onMoveEnd);

    const removeOnInitialCameraUpdate = engine.addInitialCameraUpdateListener(
      (cam) => {
        if (cam && !cameraDirty) {
          suppressNotifyForNextMove = true;
          map.jumpTo(cam);
        }
      },
    );

    return () => {
      interactionManager.remove();
      layerRenderer.remove();
      removeOnRender();
      removeOnInitialCameraUpdate();
      map.off('render', onMapRender);
      map.off('movestart', onMoveStart);
      map.off('moveend', onMoveEnd);
    };
  }, [engine, containerRef, map]);

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
        className="absolute inset-0 pointer-events-none"
      />

      <div className="absolute flex justify-end pointer-events-none bottom-[1px] right-[1px]">
        <ProgressBar
          isIndeterminate
          isHidden={!isLoadingContent}
          size="S"
          aria-label="map content loading"
        />
      </div>

      <MapToolbar />

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

import 'maplibre-gl/dist/maplibre-gl.css';
import '@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css';
import './MapContainer.css';
import { useEffect, useRef, useState } from 'react';
import { CameraPosition, MapManager } from './MapManager';
import { LayersControl } from './LayersControl';
import { AttributionControl } from './attributionControl/AttributionControl';
import { ProgressBar, ProgressCircle } from '@adobe/react-spectrum';
import { useSync } from '../api/useSync';

export function MapContainer({
  sidebarWidth,
  onMoveEnd,
  initialCamera,
}: {
  sidebarWidth: number;
  initialCamera: CameraPosition | null;
  onMoveEnd: (_: CameraPosition) => void;
}) {
  const { engine } = useSync();
  const containerRef = useRef<HTMLDivElement>(null);
  const managerRef = useRef<MapManager | null>(null);
  const sidebarWidthRef = useRef<number>(sidebarWidth);
  const initialCameraRef = useRef<CameraPosition | null>(initialCamera);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    sidebarWidthRef.current = sidebarWidth;
    managerRef.current?.resizeForSidebar(sidebarWidth);
  }, [sidebarWidth]);
  useEffect(() => {
    initialCameraRef.current = initialCamera;
  }, [initialCamera]);

  useEffect(() => {
    if (!containerRef.current || !engine) return;
    const manager = new MapManager({
      container: containerRef.current,
      engine,
      initialCamera: initialCameraRef.current,
      onMoveEnd,
      setIsLoading,
    });
    managerRef.current = manager;
    manager.resizeForSidebar(sidebarWidthRef.current);
    return () => {
      manager.remove();
      managerRef.current = null;
    };
  }, [engine, onMoveEnd]);

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

      {!engine && (
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
          <AttributionControl engine={engine} sidebarWidth={sidebarWidth} />
        </>
      )}
    </div>
  );
}

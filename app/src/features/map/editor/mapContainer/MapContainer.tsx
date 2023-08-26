import 'maplibre-gl/dist/maplibre-gl.css';
import '@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css';
import './MapContainer.css';
import { SyncEngine } from '../api/SyncEngine';
import { useEffect, useRef, useState } from 'react';
import { CameraPosition, MapManager } from './MapManager';
import { LayersControl } from './LayersControl';
import { AttributionControl } from './attributionControl/AttributionControl';
import { ProgressBar } from '@adobe/react-spectrum';

export function MapContainer({
  engine,
  sidebarWidth,
  onMoveEnd,
  initialCamera,
}: {
  engine: SyncEngine;
  sidebarWidth: number;
  initialCamera: CameraPosition | null;
  onMoveEnd: (_: CameraPosition) => void;
}) {
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
    if (!containerRef.current) return;
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
    <div ref={containerRef} className="w-full h-full">
      <div className="absolute z-10 flex justify-end pointer-events-none bottom-[1px] right-[1px]">
        <ProgressBar
          isIndeterminate
          isHidden={!isLoading}
          size="S"
          aria-label="map loading"
        />
      </div>

      <LayersControl engine={engine} />
      <AttributionControl engine={engine} sidebarWidth={sidebarWidth} />
    </div>
  );
}

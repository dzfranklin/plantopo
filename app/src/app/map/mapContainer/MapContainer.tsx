import 'maplibre-gl/dist/maplibre-gl.css';
import '@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css';
import './MapContainer.css';
import { SyncEngine } from '@/sync/SyncEngine';
import { useEffect, useRef } from 'react';
import { EditStartChannel } from '../EditStartChannel';
import { CameraPosition, MapManager } from './MapManager';
import { LayersControl } from './LayersControl';
import { AttributionControl } from './attributionControl/AttributionControl';

export function MapContainer({
  engine,
  editStart,
  sidebarWidth,
  onMoveEnd,
  initialCamera,
}: {
  engine: SyncEngine;
  editStart: EditStartChannel;
  sidebarWidth: number;
  initialCamera: CameraPosition | null;
  onMoveEnd: (_: CameraPosition) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const managerRef = useRef<MapManager | null>(null);
  const sidebarWidthRef = useRef<number>(sidebarWidth);
  const initialCameraRef = useRef<CameraPosition | null>(initialCamera);

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
      editStart,
      onMoveEnd,
    });
    managerRef.current = manager;
    manager.resizeForSidebar(sidebarWidthRef.current);
    return () => {
      manager.remove();
      managerRef.current = null;
    };
  }, [engine, editStart, onMoveEnd]);

  return (
    <div ref={containerRef} className="w-full h-full">
      <LayersControl engine={engine} />
      <AttributionControl engine={engine} sidebarWidth={sidebarWidth} />
    </div>
  );
}

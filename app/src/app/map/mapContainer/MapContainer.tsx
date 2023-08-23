import 'maplibre-gl/dist/maplibre-gl.css';
import '@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css';
import './MapContainer.css';
import { SyncEngine } from '@/sync/SyncEngine';
import { useEffect, useRef } from 'react';
import { EditStartChannel } from '../EditStartChannel';
import { MapManager } from './MapManager';
import { LayersControl } from './LayersControl';
import { AttributionControl } from './attributionControl/AttributionControl';

export function MapContainer({
  engine,
  editStart,
  sidebarWidth,
}: {
  engine: SyncEngine;
  editStart: EditStartChannel;
  sidebarWidth: number;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const managerRef = useRef<MapManager | null>(null);
  const sidebarWidthRef = useRef<number>(sidebarWidth);
  useEffect(() => {
    if (!containerRef.current) return;
    if (managerRef.current) return;
    const manager = new MapManager({
      container: containerRef.current,
      engine,
      editStart,
    });
    managerRef.current = manager;
    manager.resizeForSidebar(sidebarWidthRef.current);

    return () => {
      manager.remove();
      managerRef.current = null;
    };
  }, [engine, editStart]);
  useEffect(() => {
    sidebarWidthRef.current = sidebarWidth;
    managerRef.current?.resizeForSidebar(sidebarWidth);
  }, [sidebarWidth]);

  return (
    <div ref={containerRef} className="w-full h-full">
      <LayersControl engine={engine} />
      <AttributionControl engine={engine} sidebarWidth={sidebarWidth} />
    </div>
  );
}

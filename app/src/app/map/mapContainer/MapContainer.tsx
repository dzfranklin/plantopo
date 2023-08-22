import {
  LOrderListener,
  LPropsListener,
  Lid,
  SyncEngine,
} from '@/sync/SyncEngine';
import { useEffect, useRef } from 'react';
import 'maplibre-gl/dist/maplibre-gl.css';
import { EditStartChannel } from '../EditStartChannel';
import { MapManager } from './MapManager';
import { LayersControl } from './LayersControl';
import { useQuery } from 'react-query';
import apiBaseUrl from '@/app/apiBaseUrl';
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
  const { isSuccess: tokensLoaded, data: tokens } = useQuery('tokens', () =>
    fetch(apiBaseUrl + '/tokens.json').then((res) => res.json()),
  );

  const containerRef = useRef<HTMLDivElement>(null);
  const managerRef = useRef<MapManager | null>(null);
  useEffect(() => {
    if (!containerRef.current) return;
    if (!tokensLoaded) return;
    if (managerRef.current) return;
    const manager = new MapManager({
      container: containerRef.current,
      engine,
      tokens,
      editStart,
    });
    managerRef.current = manager;
    return () => {
      manager.remove();
      managerRef.current = null;
    };
  }, [engine, tokensLoaded, tokens, editStart]);

  return (
    <div ref={containerRef} className="w-full h-full">
      <LayersControl engine={engine} />
      <AttributionControl engine={engine} sidebarWidth={sidebarWidth} />
    </div>
  );
}

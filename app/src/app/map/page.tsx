'use client';

import { SyncSocket } from '@/sync/SyncSocket';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Sidebar from './sidebar/Sidebar';
import {
  AlertDialog,
  DialogContainer,
  ProgressCircle,
} from '@adobe/react-spectrum';
import ErrorTechInfo from '@/app/components/ErrorTechInfo';
import { SyncEngine } from '@/sync/SyncEngine';
import { MapContainer } from './mapContainer/MapContainer';
import { EditStartChannel } from './EditStartChannel';
import { CameraPosition } from './mapContainer/MapManager';

export default function MapPage() {
  const [mapId, setMapId] = useState<number | null>(null);
  useEffect(() => {
    const queryParams = new URLSearchParams(location.search);
    const param = queryParams.get('id');
    if (!param) throw new Error('id param required');
    const mapId = Number.parseInt(param, 10);
    if (param.startsWith('0') || /[^\d]/.test(param) || isNaN(mapId)) {
      throw new Error(`Invalid id param ${JSON.stringify(param)}`);
    }
    setMapId(mapId);
  }, []);

  // TODO: Request through regular http api
  const mapName = 'My Map';

  useEffect(() => {
    document.title = `${mapName} - PlanTopo`;
  }, [mapName]);

  const socketRef = useRef<SyncSocket | null>(null);
  const [engine, setEngine] = useState<SyncEngine | undefined>(undefined);
  const [syncError, setSyncError] = useState<Error | undefined>(undefined);
  useEffect(() => {
    if (mapId === null) return;
    if (socketRef.current && socketRef.current.mapId === mapId) return;
    const socket = new SyncSocket({
      mapId,
      onConnect: setEngine,
      onError: setSyncError,
      domain: location.host,
      secure: location.protocol !== 'http:',
    });
    console.log('Created socket', socket);
    socket.connect();
    socketRef.current = socket;
    () => socket.close();
  }, [mapId]);

  const editStart = useMemo(() => new EditStartChannel(), []);

  const [sidebarWidth, setSidebarWidth] = useState<number>(200);
  const loadedSidebarWidth = useRef(false);
  const pendingSidebarSave = useRef<number | null>(null);
  useEffect(() => {
    if (!loadedSidebarWidth.current) {
      // The first time we run overwrite
      const value = localStorage.getItem('sidebarWidth');
      if (value) setSidebarWidth(JSON.parse(value));
      loadedSidebarWidth.current = true;
    } else {
      // On subsequent runs save
      if (pendingSidebarSave.current !== null) {
        cancelIdleCallback(pendingSidebarSave.current);
      }
      pendingSidebarSave.current = requestIdleCallback(() => {
        pendingSidebarSave.current = null;
        localStorage.setItem('sidebarWidth', JSON.stringify(sidebarWidth));
      });
    }
  }, [sidebarWidth]);

  const [initialCamera, setInitialCamera] = useState<
    { status: 'loading' } | { status: 'loaded'; value: CameraPosition | null }
  >({ status: 'loading' });
  useEffect(() => {
    const stored = localStorage.getItem(`${mapId}-camera`);
    let value: CameraPosition | null = null;
    if (stored) value = JSON.parse(stored);
    setInitialCamera({ status: 'loaded', value });
  }, [mapId]);
  const pendingCameraSave = useRef<number | null>(null);
  const saveCamera = useCallback(
    (value: CameraPosition) => {
      if (pendingCameraSave.current !== null) {
        cancelIdleCallback(pendingCameraSave.current);
      }
      pendingCameraSave.current = requestIdleCallback(
        () => localStorage.setItem(`${mapId}-camera`, JSON.stringify(value)),
        { timeout: 10_000 },
      );
    },
    [mapId],
  );

  return (
    <div className="grid w-screen h-screen overflow-hidden">
      <DialogContainer isDismissable={false} onDismiss={() => {}}>
        {syncError && (
          <AlertDialog
            title="Sync Error"
            variant="error"
            primaryActionLabel="Reload"
            onPrimaryAction={() => document.location.reload()}
          >
            <h1 className="mb-4">{syncError.message}</h1>
            <ErrorTechInfo error={syncError} />
          </AlertDialog>
        )}
      </DialogContainer>

      {engine === undefined || initialCamera.status === 'loading' ? (
        <div className="grid place-self-center place-items-center">
          <ProgressCircle isIndeterminate aria-label="loading" size="L" />
          <h1 className="mt-4 text-center">Opening map</h1>
        </div>
      ) : (
        <>
          <MapContainer
            engine={engine}
            editStart={editStart}
            sidebarWidth={sidebarWidth}
            onMoveEnd={saveCamera}
            initialCamera={initialCamera.value}
          />
          <Sidebar
            engine={engine}
            mapName={mapName}
            editStart={editStart}
            width={sidebarWidth}
            setWidth={setSidebarWidth}
          />
        </>
      )}
    </div>
  );
}

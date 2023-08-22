'use client';

import { SyncSocket } from '@/sync/SyncSocket';
import { useEffect, useMemo, useRef, useState } from 'react';
import Sidebar from './sidebar/Sidebar';
import { AlertDialog, DialogContainer } from '@adobe/react-spectrum';
import ErrorTechInfo from '@/app/components/ErrorTechInfo';
import { SyncEngine } from '@/sync/SyncEngine';
import { MapContainer } from './mapContainer/MapContainer';
import { EditStartChannel } from './EditStartChannel';

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

  const socketRef = useRef<SyncSocket | null>(null);
  const [engine, setEngine] = useState<SyncEngine | undefined>(undefined);
  const [syncError, setSyncError] = useState<Error | undefined>(undefined);
  useEffect(() => {
    if (mapId === null) return;
    if (socketRef.current && socketRef.current.mapId === mapId) return;
    const socket = new SyncSocket(mapId, setEngine, setSyncError);
    console.log('Created socket', socket);
    socket.connect();
    socketRef.current = socket;
    () => socket.close();
  }, [mapId]);
  const editStart = useMemo(() => new EditStartChannel(), []);

  return (
    <div className="grid h-screen grid-cols-[250px_1fr] grid-rows-1 overflow-hidden">
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

      {engine === undefined ? (
        <p>Connecting...</p>
      ) : (
        <>
          <Sidebar engine={engine} mapName={mapName} editStart={editStart} />
          <MapContainer engine={engine} editStart={editStart} />
        </>
      )}
    </div>
  );
}

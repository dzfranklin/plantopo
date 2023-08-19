'use client';

import { SyncSocket } from '@/sync/SyncSocket';
import { useEffect, useMemo, useRef, useState } from 'react';
import Sidebar from './Sidebar';
import { AlertDialog, DialogContainer } from '@adobe/react-spectrum';
import ErrorTechInfo from '@/app/components/ErrorTechInfo';
import { SyncEngine } from '@/sync/SyncEngine';

export default function MapPage({ params }: { params: { id: string } }) {
  const mapId = Number.parseInt(params.id, 10);
  if (params.id.startsWith('0') || /[^\d]/.test(params.id) || isNaN(mapId)) {
    throw new Error('Invalid map id');
  }

  const socketRef = useRef<SyncSocket | null>(null);
  const [engine, setEngine] = useState<SyncEngine | undefined>(undefined);
  const [syncError, setSyncError] = useState<Error | undefined>(undefined);
  useEffect(() => {
    if (socketRef.current && socketRef.current.mapId === mapId) return;
    const socket = new SyncSocket(mapId, setEngine, setSyncError);
    socket.connect();
    socketRef.current = socket;
    () => socket.close();
  }, [mapId]);

  return (
    <div className="grid h-screen grid-cols-2 grid-rows-1 overflow-hidden">
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
          <Sidebar engine={engine} />
          <div>Map {mapId}</div>
        </>
      )}
    </div>
  );
}

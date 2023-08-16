'use client';

import { SyncSocket } from '@/sync/SyncSocket';
import { useEffect, useMemo, useState } from 'react';
import Sidebar from './Sidebar';
import { AlertDialog, DialogContainer } from '@adobe/react-spectrum';
import ErrorTechInfo from '@/app/components/ErrorTechInfo';

export default function MapPage({ params }: { params: { id: string } }) {
  const mapId = Number.parseInt(params.id, 10);
  if (params.id.startsWith('0') || /[^\d]/.test(params.id) || isNaN(mapId)) {
    throw new Error('Invalid map id');
  }

  const clientId = 42; // TODO:

  const [syncError, setSyncError] = useState<Error | undefined>(undefined);
  const driver = useMemo(
    () => new SyncSocket({ mapId, clientId, onError: setSyncError }),
    [mapId, clientId],
  );
  useEffect(() => {
    driver.connect();
  }, [driver]);

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

      <Sidebar socket={driver} />
      <div>Map {mapId}</div>
    </div>
  );
}

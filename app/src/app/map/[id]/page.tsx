'use client';

import { SyncSocket } from '@/sync/SyncSocket';
import { useEffect, useMemo, useState } from 'react';
import FeatureSidebar from './FeatureSidebar';
import { AlertDialog, DialogContainer } from '@adobe/react-spectrum';
import ErrorTechInfo from '@/app/components/ErrorTechInfo';

export default function MapPage({ params }: { params: { id: string } }) {
  const id = Number.parseInt(params.id, 10);
  if (params.id.startsWith('0') || /[^\d]/.test(params.id) || isNaN(id)) {
    throw new Error('Invalid map id');
  }

  const [syncError, setSyncError] = useState<Error | undefined>(undefined);
  const driver = useMemo(() => new SyncSocket(id, setSyncError), [id]);
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

      <FeatureSidebar driver={driver} />
      <div>Map {id}</div>
    </div>
  );
}

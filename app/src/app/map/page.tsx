'use client';

import { useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import Sidebar from './sidebar/Sidebar';
import {
  AlertDialog,
  DialogContainer,
  ProgressCircle,
} from '@adobe/react-spectrum';
import ErrorTechInfo from '@/app/components/ErrorTechInfo';
import { MapContainer } from './mapContainer/MapContainer';
import { EditStartChannel } from './EditStartChannel';
import { useInitialCamera } from './useInitialCamera';
import { useSidebarWidth } from './useSidebarWidth';
import { useSyncSocket } from './useSyncSocket';

export default function MapPage() {
  const searchParams = useSearchParams();
  const idParam = searchParams.get('id');
  const mapId = Number.parseInt(idParam || '');
  if (isNaN(mapId)) throw new Error(`Invalid id param "${idParam}"`);

  // TODO: Request through regular http api
  const mapName = 'My Map';

  useEffect(() => {
    document.title = `${mapName} - PlanTopo`;
  }, [mapName]);

  const editStart = useMemo(() => new EditStartChannel(), []);

  const socket = useSyncSocket(mapId);
  const [sidebarWidth, setSidebarWidth] = useSidebarWidth();
  const [initialCamera, saveCamera] = useInitialCamera(mapId);

  return (
    <div className="grid w-screen h-screen overflow-hidden">
      <DialogContainer isDismissable={false} onDismiss={() => {}}>
        {socket.error && (
          <AlertDialog
            title="Sync Error"
            variant="error"
            primaryActionLabel="Reload"
            onPrimaryAction={() => document.location.reload()}
          >
            <h1 className="mb-4">{socket.error.message}</h1>
            <ErrorTechInfo error={socket.error} />
          </AlertDialog>
        )}
      </DialogContainer>

      {socket.engine === undefined || initialCamera.status === 'loading' ? (
        <div className="grid place-self-center place-items-center">
          <ProgressCircle isIndeterminate aria-label="loading" size="L" />
          <h1 className="mt-4 text-center">Opening map</h1>
        </div>
      ) : (
        <>
          <MapContainer
            engine={socket.engine}
            editStart={editStart}
            sidebarWidth={sidebarWidth}
            onMoveEnd={saveCamera}
            initialCamera={initialCamera.value}
          />
          <Sidebar
            engine={socket.engine}
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

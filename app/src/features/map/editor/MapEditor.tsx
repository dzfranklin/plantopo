import { useMapMeta } from '@/features/map/api/useMapMeta';
import { useCurrentUser } from '@/features/account/useCurrentUser';
import { goToLogin } from '@/features/account/api/goToLogin';
import { UnauthorizedError } from '@/api/errors';
import { useSidebarWidth } from './Sidebar/useSidebarWidth';
import { useInitialCamera } from './MapContainer/useInitialCamera';
import { PageTitle } from '@/generic/PageTitle';
import { AlertDialog, DialogContainer } from '@adobe/react-spectrum';
import ErrorTechInfo from '@/generic/ErrorTechInfo';
import { MapContainer } from './MapContainer/MapContainer';
import Sidebar from './Sidebar/Sidebar';
import { useEffect, useState } from 'react';
import { Titlebar } from './TitleBar/Titlebar';
import { SyncSocket } from './api/SyncSocket';
import { SyncSocketProvider } from './api/useSync';
import { SyncEngine } from './api/SyncEngine';

export function MapEditor({ mapId }: { mapId: number }) {
  const isLoggedIn = useCurrentUser() !== null;

  const meta = useMapMeta(mapId);

  const [syncSocket, setSyncSocket] = useState<SyncSocket | null>(null);
  const [openError, setOpenError] = useState<Error>();
  useEffect(() => {
    const socket = new SyncSocket(mapId);
    socket.addStateListener((state) => {
      if (state.status === 'openError') {
        if (state.error instanceof UnauthorizedError && !isLoggedIn) {
          goToLogin();
        } else {
          setOpenError(state.error);
        }
      }
    });
    setSyncSocket(socket);
    return () => socket.close();
  }, [isLoggedIn, mapId]);

  const [sidebarWidth, setSidebarWidth] = useSidebarWidth();
  const [initialCamera, saveCamera] = useInitialCamera(mapId);

  return (
    <div className="grid grid-cols-1 grid-rows-[30px_minmax(0,1fr)] w-full h-full overflow-hidden">
      <PageTitle
        title={meta.data ? `${meta.data.name || 'Untitled map'}` : 'Loading...'}
      />

      <DialogContainer isDismissable={false} onDismiss={() => {}}>
        {openError && (
          <AlertDialog
            title={'Error opening map'}
            variant="error"
            primaryActionLabel={'Reload'}
            onPrimaryAction={() => document.location.reload()}
          >
            <h1 className="mb-4">{openError.message}</h1>
            <ErrorTechInfo error={openError} />
          </AlertDialog>
        )}
      </DialogContainer>

      {/* syncSocket and initialCamera load quickly (no network) */}
      {syncSocket && initialCamera.status === 'loaded' && (
        <SyncSocketProvider socket={syncSocket}>
          <Titlebar />

          <div className="relative">
            <MapContainer
              sidebarWidth={sidebarWidth}
              onMoveEnd={saveCamera}
              initialCamera={initialCamera.value}
            />
            <Sidebar width={sidebarWidth} setWidth={setSidebarWidth} />
          </div>
        </SyncSocketProvider>
      )}
    </div>
  );
}

import { useMapMeta } from '@/features/map/api/useMapMeta';
import { useCurrentUser } from '@/features/account/useCurrentUser';
import { useSyncSocket } from './api/useSyncSocket';
import { goToLogin } from '@/features/account/api/goToLogin';
import { UnauthorizedError } from '@/api/errors';
import { useSidebarWidth } from './Sidebar/useSidebarWidth';
import { useInitialCamera } from './MapContainer/useInitialCamera';
import { PageTitle } from '@/generic/PageTitle';
import {
  AlertDialog,
  DialogContainer,
  ProgressCircle,
} from '@adobe/react-spectrum';
import ErrorTechInfo from '@/generic/ErrorTechInfo';
import { MapContainer } from './MapContainer/MapContainer';
import Sidebar from './Sidebar/Sidebar';
import { useEffect } from 'react';
import { Titlebar } from './TitleBar/Titlebar';

export function MapEditor({ mapId }: { mapId: number }) {
  const isLoggedIn = useCurrentUser() !== null;

  const meta = useMapMeta(mapId);
  const sync = useSyncSocket(mapId);

  const [sidebarWidth, setSidebarWidth] = useSidebarWidth();
  const [initialCamera, saveCamera] = useInitialCamera(mapId);

  const loginCouldResolveSyncError =
    sync.state.status === 'openError' &&
    sync.state.error instanceof UnauthorizedError &&
    !isLoggedIn;
  useEffect(() => {
    if (loginCouldResolveSyncError) goToLogin();
  }, [loginCouldResolveSyncError]);

  return (
    <div className="grid w-full h-full overflow-hidden">
      <PageTitle
        title={meta.data ? `${meta.data.name || 'Untitled map'}` : 'Loading...'}
      />

      <DialogContainer isDismissable={false} onDismiss={() => {}}>
        {sync.state.status === 'openError' && (
          <AlertDialog
            title={'Error opening map'}
            variant="error"
            primaryActionLabel={'Reload'}
            onPrimaryAction={() => document.location.reload()}
          >
            <h1 className="mb-4">{sync.state.error.message}</h1>
            <ErrorTechInfo error={sync.state.error} />
          </AlertDialog>
        )}
      </DialogContainer>

      {!meta.data ||
      !sync.engine ||
      !sync.socket ||
      initialCamera.status === 'loading' ? (
        <div className="grid place-self-center place-items-center">
          <ProgressCircle isIndeterminate aria-label="loading" size="L" />
          <h1 className="mt-4 text-center">Opening map</h1>
        </div>
      ) : (
        <>
          <Titlebar meta={meta.data} sync={sync.state} />
          <MapContainer
            engine={sync.engine}
            sidebarWidth={sidebarWidth}
            onMoveEnd={saveCamera}
            initialCamera={initialCamera.value}
          />
          <Sidebar
            socket={sync.socket}
            engine={sync.engine}
            meta={meta.data}
            width={sidebarWidth}
            setWidth={setSidebarWidth}
          />
        </>
      )}
    </div>
  );
}

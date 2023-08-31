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
import { useEffect, useRef, useState } from 'react';
import { Titlebar } from './TitleBar/Titlebar';
import { SyncSocket } from './api/SyncSocket';
import { SyncSocketProvider } from './api/useSync';
import { useMapSources } from '../api/useMapSources';
import { EMPTY_SCENE } from './api/SyncEngine/Scene';
import { SyncEngine } from './api/SyncEngine';
import { SceneProvider } from './api/useScene';
import { ZERO_CAMERA } from './CameraPosition';
import { useTokens } from '../api/useTokens';

export function MapEditor({ mapId }: { mapId: number }) {
  const isLoggedIn = useCurrentUser() !== null;

  const meta = useMapMeta(mapId);
  const { data: mapSources } = useMapSources();

  const [syncSocket, setSyncSocket] = useState<SyncSocket | null>(null);
  const [openError, setOpenError] = useState<Error>();
  const [engine, setEngine] = useState<SyncEngine | null>(null);
  useEffect(() => {
    if (!mapSources) return;
    // NOTE: We could fetch mapSources in parallel with the socket connect
    const socket = new SyncSocket(mapId, { mapSources });
    socket.addStateListener((state) => {
      if (state.status === 'openError') {
        if (state.error instanceof UnauthorizedError && !isLoggedIn) {
          goToLogin();
        } else {
          setOpenError(state.error);
        }
      }

      if ('engine' in state) {
        setEngine(state.engine);
      } else {
        setEngine(null);
      }
    });
    setSyncSocket(socket);
    return () => socket.close();
  }, [mapSources, isLoggedIn, mapId]);

  const [scene, setScene] = useState(EMPTY_SCENE);
  const nextTick = useRef<number | null>(null);
  useEffect(() => {
    if (!engine) return;
    const enqueueTick = () => {
      nextTick.current = requestAnimationFrame(() => {
        setScene(engine.render());
        enqueueTick();
      });
    };
    enqueueTick();
    return () => {
      if (nextTick.current) cancelAnimationFrame(nextTick.current);
    };
  }, [engine]);

  const [sidebarWidth, setSidebarWidth] = useSidebarWidth();
  const [initialCamera, saveCamera] = useInitialCamera(mapId);

  // Start fetching for the MapContainer
  useTokens();

  return (
    <SceneProvider scene={scene}>
      <div className="grid grid-cols-1 grid-rows-[30px_minmax(0,1fr)] w-full h-full overflow-hidden">
        <PageTitle
          title={
            meta.data ? `${meta.data.name || 'Untitled map'}` : 'Loading...'
          }
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
                saveCamera={saveCamera}
                initialCamera={initialCamera.value || ZERO_CAMERA}
              />
              <Sidebar width={sidebarWidth} setWidth={setSidebarWidth} />
            </div>
          </SyncSocketProvider>
        )}
      </div>
    </SceneProvider>
  );
}

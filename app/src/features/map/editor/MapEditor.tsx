import { useMapMeta } from '@/features/map/api/useMapMeta';
import { useCurrentUser } from '@/features/account/useCurrentUser';
import { useMapSync } from './api/useMapSync';
import { goToLogin } from '@/features/account/api/goToLogin';
import { UnauthorizedError } from '@/api/errors';
import { useSidebarWidth } from './sidebar/useSidebarWidth';
import { useInitialCamera } from './mapContainer/useInitialCamera';
import { PageTitle } from '@/generic/PageTitle';
import {
  AlertDialog,
  DialogContainer,
  ProgressCircle,
} from '@adobe/react-spectrum';
import ErrorTechInfo from '@/generic/ErrorTechInfo';
import { MapContainer } from './mapContainer/MapContainer';
import Sidebar from './sidebar/Sidebar';

export function MapEditor({ mapId }: { mapId: number }) {
  const isLoggedIn = useCurrentUser() !== null;

  const meta = useMapMeta(mapId);
  const sync = useMapSync(mapId, {
    onError: (error) => {
      if (error instanceof UnauthorizedError && !isLoggedIn) {
        goToLogin();
      }
    },
  });

  const [sidebarWidth, setSidebarWidth] = useSidebarWidth();
  const [initialCamera, saveCamera] = useInitialCamera(mapId);

  return (
    <div className="grid w-full h-full overflow-hidden">
      <PageTitle
        title={meta.data ? `${meta.data.name || 'Untitled map'}` : 'Loading...'}
      />

      <DialogContainer isDismissable={false} onDismiss={() => {}}>
        {sync.error && (
          <AlertDialog
            title={sync.engine ? 'Error syncing map' : 'Error opening map'}
            variant="error"
            primaryActionLabel={'Reload'}
            onPrimaryAction={() => document.location.reload()}
          >
            <h1 className="mb-4">{sync.error.message}</h1>
            <ErrorTechInfo error={sync.error} />
          </AlertDialog>
        )}
      </DialogContainer>

      {!meta.data || !sync.engine || initialCamera.status === 'loading' ? (
        <div className="grid place-self-center place-items-center">
          <ProgressCircle isIndeterminate aria-label="loading" size="L" />
          <h1 className="mt-4 text-center">Opening map</h1>
        </div>
      ) : (
        <>
          <MapContainer
            engine={sync.engine}
            sidebarWidth={sidebarWidth}
            onMoveEnd={saveCamera}
            initialCamera={initialCamera.value}
          />
          {
            <Sidebar
              engine={sync.engine}
              meta={meta.data}
              width={sidebarWidth}
              setWidth={setSidebarWidth}
            />
          }
        </>
      )}
    </div>
  );
}

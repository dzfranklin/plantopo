'use client';

import { useSearchParams } from 'next/navigation';
import Sidebar from './sidebar/Sidebar';
import {
  AlertDialog,
  DialogContainer,
  ProgressCircle,
} from '@adobe/react-spectrum';
import ErrorTechInfo from '@/app/components/ErrorTechInfo';
import { MapContainer } from './mapContainer/MapContainer';
import { useInitialCamera } from './mapContainer/useInitialCamera';
import { useSidebarWidth } from './sidebar/useSidebarWidth';
import { useMapSync } from '@/api/map/sync/useMapSync';
import { useMapMeta } from '@/api/map/useMapMeta';
import { UnauthorizedError } from '@/api/errors';
import { goToLogin } from '@/api/account/redirectToLogin';
import { useCurrentUser } from '../useCurrentUser';
import { PageTitle } from '../PageTitle';

export default function MapPage() {
  const isLoggedIn = useCurrentUser() !== null;
  const searchParams = useSearchParams();
  const idParam = searchParams.get('id');
  const mapId = Number.parseInt(idParam || '');
  if (isNaN(mapId)) throw new Error(`Invalid id param "${idParam}"`);

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
    <div className="grid w-screen h-screen overflow-hidden">
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

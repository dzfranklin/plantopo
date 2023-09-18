import { useMapMeta } from '@/features/map/api/mapMeta';
import { PageTitle } from '@/generic/PageTitle';
import { AlertDialog, DialogContainer } from '@adobe/react-spectrum';
import ErrorTechInfo from '@/generic/ErrorTechInfo';
import { MapContainer } from './MapContainer/MapContainer';
import Sidebar from './Sidebar/Sidebar';
import { useEffect, useState } from 'react';
import { Titlebar } from './TitleBar/Titlebar';
import { EditorEngineProvider } from './engine/useEngine';
import { useMapSources } from '../api/useMapSources';
import { useTokensQuery } from '../api/useTokens';
import { useSession, useSessionRedirector } from '@/features/account/session';
import { EditorEngine } from './engine/EditorEngine';
import { AppError } from '@/api/errors';
import { notFound } from 'next/navigation';

export function MapEditor({ mapId }: { mapId: string }) {
  const session = useSession();
  const sessionRedirector = useSessionRedirector();

  const meta = useMapMeta(mapId);
  const mapSources = useMapSources();

  useEffect(() => {
    if (meta.error instanceof AppError) {
      if (meta.error.code === 404) notFound();
      else if (meta.error.code === 401 && !session) sessionRedirector();
    }
  }, [meta.error, session, sessionRedirector]);

  const [engine, setEngine] = useState<EditorEngine | null>(null);
  useEffect(() => {
    if (!meta.data) return;
    const engine = new EditorEngine({
      mapId,
      // NOTE: We shouldn't need to wait for meta to load to initialize the engine
      mayEdit: meta.data.currentSessionMayEdit,
      mapSources,
    });
    setEngine(engine);
    return () => {
      setEngine(null);
      engine.destroy();
    };
  }, [mapSources, mapId, meta.data]);

  // Start fetching for the MapContainer
  useTokensQuery();

  return (
    <div className="grid grid-cols-1 grid-rows-[30px_minmax(0,1fr)] w-full h-full overflow-hidden">
      <PageTitle
        title={meta.data ? `${meta.data.name || 'Untitled map'}` : 'Loading...'}
      />

      <DialogContainer isDismissable={false} onDismiss={() => {}}>
        {meta.error && (
          <AlertDialog
            title={'Error opening map'}
            variant="error"
            primaryActionLabel={'Reload'}
            onPrimaryAction={() => document.location.reload()}
          >
            <h1 className="mb-4">{meta.error.message}</h1>
            <ErrorTechInfo error={meta.error} />
          </AlertDialog>
        )}
      </DialogContainer>

      {engine && (
        <EditorEngineProvider engine={engine}>
          <Titlebar />

          <div className="relative">
            <MapContainer />
            <Sidebar />
          </div>
        </EditorEngineProvider>
      )}
    </div>
  );
}

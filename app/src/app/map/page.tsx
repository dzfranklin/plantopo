'use client';

import { notFound, useSearchParams } from 'next/navigation';
import { PageTitle } from '../../generic/PageTitle';
import { useMapMeta } from '@/features/map/api/mapMeta';
import { useEffect, useState } from 'react';
import { AppError } from '@/api/errors';
import { MapEditor } from '@/features/map/editor/MapEditor';
import { useSession, useSessionRedirector } from '@/features/account/session';
import { useMapSources } from '@/features/map/api/useMapSources';
import { EditorEngine } from '@/features/map/editor/engine/EditorEngine';
import { EditorEngineProvider } from '@/features/map/editor/engine/useEngine';
import { AlertDialog, DialogContainer } from '@adobe/react-spectrum';
import ErrorTechInfo from '@/generic/ErrorTechInfo';
import { useTokensQuery } from '@/features/map/api/useTokens';

export default function MapPage() {
  const session = useSession();
  const sessionRedirector = useSessionRedirector();

  const searchParams = useSearchParams();
  const mapId = searchParams.get('id');
  if (!mapId) notFound();

  const meta = useMapMeta(mapId);
  useEffect(() => {
    if (meta.error instanceof AppError) {
      if (meta.error.code === 404) notFound();
      else if (meta.error.code === 401 && !session) sessionRedirector();
    }
  }, [meta.error, session, sessionRedirector]);

  const mapSources = useMapSources();

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

  // Avoid starting this blocker after the metadata is loaded.
  // NOTE: If we fix waiting for meta to load the engine we don't need this
  useTokensQuery();

  return (
    <div className="w-screen h-screen">
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
          <MapEditor />
        </EditorEngineProvider>
      )}
    </div>
  );
}

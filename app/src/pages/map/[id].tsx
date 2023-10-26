'use client';

import '../../globals.css';
import { PageTitle } from '../../generic/PageTitle';
import { useMapMeta } from '@/features/map/api/mapMeta';
import { useEffect, useMemo, useState } from 'react';
import { AppError } from '@/api/errors';
import { MapEditor } from '@/features/map/editor/MapEditor';
import { useSession, useSessionRedirector } from '@/features/account/session';
import { useMapSources } from '@/features/map/api/useMapSources';
import { EditorEngine } from '@/features/map/editor/engine/EditorEngine';
import { EditorEngineProvider } from '@/features/map/editor/engine/useEngine';
import { AlertDialog, DialogContainer } from '@adobe/react-spectrum';
import ErrorTechInfo from '@/features/error/ErrorTechInfo';
import { useTokensQuery } from '@/features/map/api/useTokens';
import { CommandProvider } from '@/features/commands/commands';
import { GetStaticPaths, GetStaticProps } from 'next';
import {
  CameraURLParam,
  parseCameraURLParam,
  serializeCameraURLParam,
} from '@/features/map/editor/cameraURLParam';
import { useRouter } from 'next/router';

const defaultInitialCamera: CameraURLParam = {
  center: [-55.6923608, 42.4948239],
  zoom: 2,
  bearing: 0,
  pitch: 0,
};

export default function MapPage() {
  const router = useRouter();
  const session = useSession();
  const sessionRedirector = useSessionRedirector();

  const mapId = useMemo(() => pathParts(router.asPath).at(-1), [router.asPath]);
  if (!mapId) notFound();

  const [initialCamera] = useState(() => {
    const query = new URL(router.asPath, 'https://plantopo.com').searchParams;
    const raw = query.get('c') ?? '';
    return parseCameraURLParam(raw) ?? defaultInitialCamera;
  });

  const meta = useMapMeta(mapId);
  const isRedirectedError =
    meta.error instanceof AppError &&
    (meta.error.code === 404 || (meta.error.code === 401 && !session));
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
      initialCamera,
    });

    let updateHistoryCameraTick: number | undefined;
    engine.addCameraMoveEndListener((cam) => {
      updateHistoryCameraTick && cancelIdleCallback(updateHistoryCameraTick);
      updateHistoryCameraTick = requestIdleCallback(() => {
        history.replaceState(null, '', `?c=${serializeCameraURLParam(cam)}`);
        updateHistoryCameraTick = undefined;
      });
    });

    setEngine(engine);

    return () => {
      setEngine(null);
      engine.destroy();
    };
  }, [mapSources, mapId, meta.data, router, initialCamera]);

  // Avoid starting this blocker after the metadata is loaded.
  // NOTE: If we fix waiting for meta to load the engine we don't need this
  useTokensQuery();

  return (
    <div className="w-screen h-screen">
      <PageTitle
        title={meta.data ? `${meta.data.name || 'Untitled map'}` : 'Loading...'}
      />

      <DialogContainer isDismissable={false} onDismiss={() => {}}>
        {meta.error && !isRedirectedError && (
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

      <EditorEngineProvider engine={engine}>
        <CommandProvider>
          <MapEditor />
        </CommandProvider>
      </EditorEngineProvider>
    </div>
  );
}

export const getStaticProps = (async () => {
  return {
    props: {},
  };
}) satisfies GetStaticProps;

export const getStaticPaths = (async () => {
  return {
    paths: [
      {
        params: {
          id: '__id__',
        },
      },
    ],
    fallback: false,
  };
}) satisfies GetStaticPaths;

function notFound(): never {
  window.location.href = '/map-not-found';
  throw new Error('Redirecting');
}

function pathParts(pathname: string): string[] {
  // needed because the nextjs pages router includes the query in pathname
  const url = new URL(pathname, 'https://plantopo.com');
  pathname = url.pathname;

  if (pathname.startsWith('/')) {
    pathname = pathname.substring(1);
  }
  if (pathname.endsWith('/')) {
    pathname = pathname.substring(0, pathname.length - 1);
  }

  return pathname.split('/');
}

'use client';

import '../../globals.css';
import { usePathname, useSearchParams } from 'next/navigation';
import { PageTitle } from '../../generic/PageTitle';
import { useMapMeta } from '@/features/map/api/mapMeta';
import { useEffect, useState } from 'react';
import { AppError } from '@/api/errors';
import { MapEditor } from '@/features/map/editor/MapEditor';
import {
  SessionProvider,
  useSession,
  useSessionRedirector,
} from '@/features/account/session';
import { useMapSources } from '@/features/map/api/useMapSources';
import { EditorEngine } from '@/features/map/editor/engine/EditorEngine';
import { EditorEngineProvider } from '@/features/map/editor/engine/useEngine';
import { AlertDialog, DialogContainer } from '@adobe/react-spectrum';
import ErrorTechInfo from '@/generic/ErrorTechInfo';
import { useTokensQuery } from '@/features/map/api/useTokens';
import { CommandProvider } from '@/features/commands/commands';
import { GetStaticPaths, GetStaticProps } from 'next';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import {
  defaultTheme as defaultSpectrumTheme,
  Provider as SpectrumProvider,
} from '@adobe/react-spectrum';

export default function MapPageShell() {
  const queryClient = new QueryClient();

  const session = useSession();
  const sessionRedirector = useSessionRedirector();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const mapId = pathname ? pathParts(pathname).at(-1) : undefined;

  return (
    <QueryClientProvider client={queryClient}>
      <SpectrumProvider
        theme={defaultSpectrumTheme}
        // Set render consistently on the server so Next.js can
        // rehydrate. Is there a better way to do this?
        locale="en-US"
        scale="medium"
        minHeight="100vh"
      >
        <SessionProvider>{mapId && <MapPage mapId={mapId} />}</SessionProvider>
        <div id="portal-container" className="z-[60]"></div>
        <ReactQueryDevtools initialIsOpen={false} />
      </SpectrumProvider>
    </QueryClientProvider>
  );
}

function MapPage({ mapId }: { mapId: string }) {
  const session = useSession();
  const sessionRedirector = useSessionRedirector();

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
          <CommandProvider>
            <MapEditor />
          </CommandProvider>
        </EditorEngineProvider>
      )}
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
  if (pathname.startsWith('/')) {
    pathname = pathname.substring(1);
  }
  if (pathname.endsWith('/')) {
    pathname = pathname.substring(0, pathname.length - 1);
  }
  return pathname.split('/');
}
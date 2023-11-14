'use client';

import '../../globals.css';
import { PageTitle } from '../../generic/PageTitle';
import { MapMeta, useMapMeta } from '@/features/map/api/mapMeta';
import { useEffect, useMemo, useState } from 'react';
import { AppError } from '@/api/errors';
import { MapEditor } from '@/features/map/editor/MapEditor';
import { useSession, useSessionRedirector } from '@/features/account/session';
import { useMapSources } from '@/features/map/api/useMapSources';
import {
  EditorEngine,
  InitialCamera,
} from '@/features/map/editor/engine/EditorEngine';
import { EditorEngineProvider } from '@/features/map/editor/engine/useEngine';
import { GetStaticPaths, GetStaticProps } from 'next';
import {
  parseCameraURLParam,
  serializeCameraURLParam,
} from '@/features/map/editor/cameraURLParam';
import { useRouter } from 'next/router';
import {
  MyGeolocation,
  useMyGeolocation,
} from '@/features/map/api/useMyGeolocation';
import { MapIdProvider } from '@/features/map/editor/useMapId';
import { UseQueryResult } from '@tanstack/react-query';
import NotFoundPage from '@/app/not-found';

export default function MapPage() {
  const router = useRouter();
  const session = useSession();
  const sessionRedirector = useSessionRedirector();
  const mapId = useMemo(
    () => pathParts(router.asPath).at(-1)!,
    [router.asPath],
  );
  const meta = useMapMeta(mapId);
  const engine = useEngineForPage(meta);

  const error = meta.error;
  if (error) {
    if (error instanceof AppError) {
      if (error.code === 401 && session === null) {
        sessionRedirector();
        return;
      }
      if (error.code === 401 || error.code === 403) {
        router.replace(`/request-access?mapId=${mapId}`);
        return;
      }
      if (error.code === 404) {
        return <NotFoundPage />;
      }
    }
    throw error;
  }

  return (
    <div className="w-screen h-screen">
      {meta.isLoading && <PageTitle title="Opening map..." />}
      {meta.data && <PageTitle title={meta.data.name || 'Unnamed map'} />}

      <MapIdProvider mapId={mapId}>
        <EditorEngineProvider engine={engine}>
          <MapEditor />
        </EditorEngineProvider>
      </MapIdProvider>
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

function useEngineForPage(meta: UseQueryResult<MapMeta>): EditorEngine | null {
  const router = useRouter();

  const mapId = useMemo(() => pathParts(router.asPath).at(-1), [router.asPath]);
  if (!mapId) notFound();

  const [initialCameraURLParam] = useState(() => {
    const query = new URL(router.asPath, 'https://plantopo.com').searchParams;
    const raw = query.get('c') ?? '';
    return parseCameraURLParam(raw);
  });

  const myGeolocation = useMyGeolocation();

  const mapSources = useMapSources();

  const [engine, setEngine] = useState<EditorEngine | null>(null);
  useEffect(() => {
    if (!meta.data) return;

    let initialCamera: InitialCamera | undefined = initialCameraURLParam;
    if (initialCamera === undefined && myGeolocation.data) {
      initialCamera = initialCameraFromMyGeolocation(myGeolocation.data);
    }

    const engine = new EditorEngine({
      mapId,
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
  }, [
    mapSources,
    mapId,
    meta.data,
    router,
    initialCameraURLParam,
    myGeolocation.data,
  ]);

  useEffect(() => {
    if (engine && myGeolocation.data) {
      engine.updateInitialCamera(
        initialCameraFromMyGeolocation(myGeolocation.data),
      );
    }
  }, [engine, myGeolocation.data]);

  return engine;
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

function initialCameraFromMyGeolocation(
  data: MyGeolocation,
): InitialCamera | undefined {
  return {
    center: [data.longitude, data.latitude],
    zoom: 10,
    bearing: 0,
    pitch: 0,
  };
}

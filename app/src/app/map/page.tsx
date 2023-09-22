'use client';

import { notFound, useSearchParams } from 'next/navigation';
import { PageTitle } from '../../generic/PageTitle';
import { MapEditor } from '@/features/map/editor/MapEditor';
import { useMapMeta } from '@/features/map/api/mapMeta';
import { useEffect } from 'react';
import { AppError } from '@/api/errors';

export default function MapPage() {
  const searchParams = useSearchParams();
  const mapId = searchParams.get('id');
  if (!mapId) notFound();
  const meta = useMapMeta(mapId);
  useEffect(() => {
    if (meta.error instanceof AppError && meta.error.code === 404) {
      notFound();
    }
  }, [meta.error]);

  return (
    <div className="w-screen h-screen">
      <PageTitle
        title={meta.data ? `${meta.data.name || 'Untitled map'}` : 'Loading...'}
      />

      <MapEditor mapId={mapId} />
    </div>
  );
}

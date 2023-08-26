'use client';

import { useSearchParams } from 'next/navigation';
import { PageTitle } from '../../generic/PageTitle';
import { MapEditor } from '@/features/map/editor/MapEditor';
import { useMapMeta } from '@/features/map/api/useMapMeta';

export default function MapPage() {
  const searchParams = useSearchParams();
  const idParam = searchParams.get('id');
  const mapId = Number.parseInt(idParam || '');
  if (isNaN(mapId)) throw new Error(`Invalid id param "${idParam}"`);

  const meta = useMapMeta(mapId);

  return (
    <div className="w-screen h-screen">
      <PageTitle
        title={meta.data ? `${meta.data.name || 'Untitled map'}` : 'Loading...'}
      />

      <MapEditor mapId={mapId} />
    </div>
  );
}

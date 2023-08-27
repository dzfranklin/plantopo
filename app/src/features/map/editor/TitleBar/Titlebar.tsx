import { MapIcon } from '@/generic/MapIcon';
import { useMapMeta } from '../../api/useMapMeta';
import Link from 'next/link';
import { useSync } from '../api/useSync';

export function Titlebar() {
  const sync = useSync();
  const meta = useMapMeta(sync.mapId);

  return (
    <div className="flex px-1.5 items-center overflow-hidden h-[30px] text-sm border-b border-neutral-400 bg-neutral-100">
      <Link href="/" className="text-blue-700">
        <MapIcon />
      </Link>
      <span className="truncate">
        {meta.data ? meta.data.name || 'Unnamed map' : 'Loading...'}
      </span>
      {JSON.stringify(sync.status)}
      {sync.pendingChanges}
    </div>
  );
}

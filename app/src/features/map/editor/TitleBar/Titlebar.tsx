import { MapMeta } from '../../api/MapMeta';
import { SyncSocketState } from '../api/SyncSocket';

export function Titlebar({
  sync,
  meta,
}: {
  sync: SyncSocketState;
  meta: MapMeta;
}) {
  return <div>Titlebar</div>;
}

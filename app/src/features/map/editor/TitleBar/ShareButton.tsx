import cls from '@/generic/cls';
import { useMapId } from '../useMapId';
import { useMapMeta } from '../../api/mapMeta';
import { useState } from 'react';
import { MapShareDialog } from '../../MapShareDialog/MapShareDialog';
import { DialogContainer } from '@adobe/react-spectrum';
import ShareIcon from '@spectrum-icons/workflow/GlobeOutline';
import { useSession } from '@/features/account/session';

export function ShareButton() {
  const mapId = useMapId();
  const session = useSession();
  const meta = useMapMeta(mapId);
  const [showDialog, setShowDialog] = useState(false);
  return (
    <>
      <button
        type="button"
        disabled={!session || !meta.data}
        className={cls(
          'flex items-center gap-2 rounded-3xl bg-[#a3daff] px-5 py-2 text-sm font-medium text-black shadow-sm',
          'disabled:opacity-50 disabled:bg-gray-300 disabled:cursor-default',
          'hover:bg-[#80ccff] hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2',
        )}
        onClick={() => setShowDialog(true)}
      >
        <ShareIcon size="S" />
        Share
      </button>

      <DialogContainer onDismiss={() => setShowDialog(false)}>
        {showDialog && <MapShareDialog item={meta.data!} />}
      </DialogContainer>
    </>
  );
}

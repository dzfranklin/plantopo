import cls from '@/generic/cls';
import { useMapId } from '../useMapId';
import { useMapMeta } from '../../api/mapMeta';
import { useState } from 'react';
import { AlertDialog, Content, DialogContainer } from '@adobe/react-spectrum';
import { useLoadedSession } from '@/features/account/session';
import { useRouter } from 'next/router';

export function RequestEditAccessButton() {
  const mapId = useMapId();
  const router = useRouter();
  const session = useLoadedSession();
  const meta = useMapMeta(mapId);
  const [showMustLoginDialog, setShowMustLoginDialog] = useState(false);
  return (
    <>
      <button
        type="button"
        disabled={session === 'loading' || !meta.data}
        className={cls(
          'flex items-center gap-2 truncate rounded-3xl px-5 py-2 text-sm font-medium border border-gray-400 text-blue-600 shadow-sm',
          'disabled:cursor-default',
          'hover:bg-gray-100 hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2',
        )}
        onClick={() => {
          if (session) {
            router.push(`/request-access?mapId=${mapId}`);
          } else {
            setShowMustLoginDialog(true);
          }
        }}
        title={
          !session
            ? 'You must be logged in to request access from the owner'
            : ''
        }
      >
        Request edit access
      </button>

      <DialogContainer onDismiss={() => setShowMustLoginDialog(false)}>
        {showMustLoginDialog && (
          <AlertDialog
            title="Login required"
            primaryActionLabel="Login"
            secondaryActionLabel="Sign up"
            onPrimaryAction={() => {
              location.href =
                '/login?returnTo=' +
                encodeURIComponent(location.pathname + location.search);
            }}
            onSecondaryAction={() => {
              location.href =
                '/signup?returnTo=' +
                encodeURIComponent(location.pathname + location.search);
            }}
          >
            <Content>
              You must be logged in to request access from the owner.
            </Content>
          </AlertDialog>
        )}
      </DialogContainer>
    </>
  );
}

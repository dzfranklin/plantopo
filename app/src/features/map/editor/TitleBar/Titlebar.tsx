import { MapIcon } from '@/generic/MapIcon';
import { TitlebarMenu } from './TitlebarMenu';
import cls from '@/generic/cls';
import { Focuser, TitleEditComponent } from './TitleEditComponent';
import { StatusComponent } from './StatusComponent';
import { useRef } from 'react';
import { ShareButton } from './ShareButton';
import { useLoadedSession } from '@/features/account/session';
import { RequestEditAccessButton } from './RequestEditAccessButton';
import { LoginButton } from './LoginButton';
import { useMapMeta } from '../../api/mapMeta';
import { useMapId } from '../useMapId';
import { AwarenessComponent } from './AwarenessComponent';

export function Titlebar() {
  const mapId = useMapId();
  const titleEditRef = useRef<Focuser>(null);
  const sess = useLoadedSession();
  const meta = useMapMeta(mapId);
  const mayEdit = meta.data?.currentSessionMayEdit;
  return (
    <div
      className={cls(
        'grid grid-cols-[min-content_1fr_max-content] grid-rows-[min-content_min-content]',
        'pl-3 pr-1 py-1 items-center border-b border-neutral-300 bg-neutral-100',
      )}
    >
      <div className="col-start-1 pr-2 row-span-full">
        {/* Ordinary navigation avoids bugs around pages router -> app router  */}
        <a href="/dashboard" className="text-blue-700">
          <MapIcon />
        </a>
      </div>

      <div className="flex col-start-2 row-start-1 gap-2 mx-1">
        <TitleEditComponent ref={titleEditRef} />
      </div>

      <div className="flex items-center col-start-2 row-start-2 gap-4">
        <TitlebarMenu focusTitleEdit={() => titleEditRef.current?.focus()} />
        <StatusComponent />
      </div>

      <div className="flex items-end h-full col-start-3 mb-4 row-span-full">
        <AwarenessComponent />
      </div>

      <div className="flex items-center col-start-4 gap-4 p-1 pl-8 row-span-full">
        {mayEdit === false && <RequestEditAccessButton />}
        <ShareButton />
        {sess === null && <LoginButton />}
      </div>
    </div>
  );
}

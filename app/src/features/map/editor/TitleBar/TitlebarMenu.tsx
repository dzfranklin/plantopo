import { ImportDialog } from '@/features/importer/ImportDialog';
import cls from '@/generic/cls';
import { DialogContainer } from '@adobe/react-spectrum';
import { useState } from 'react';
import {
  Button,
  Item,
  Menu,
  MenuTrigger,
  Popover,
  // Separator,
} from 'react-aria-components';
import type { ItemProps } from 'react-aria-components';
import { useEngine } from '../engine/useEngine';
import { MapShareDialog } from '../../MapShareDialog/MapShareDialog';
import { useMapMeta } from '../../api/mapMeta';
import { useMapId } from '../useMapId';

export function TitlebarMenu() {
  const engine = useEngine();
  const mapId = useMapId();
  const meta = useMapMeta(mapId);
  const [dialog, setDialog] = useState<'import' | 'share' | null>(null);
  const onAction = (menu: string, key: string) => {
    if (menu === 'edit') {
      switch (key) {
        case 'import':
          setDialog('import');
          break;
        case 'share':
          setDialog('share');
          break;
      }
    }
  };

  return (
    <div className="mt-0.5">
      <MenuTrigger>
        <Button
          aria-label="Menu"
          className={cls(
            'mx-1 inline-flex items-center justify-center px-1.5 py-0.5 rounded outline-none text-sm',
            'hover:bg-gray-300 aria-expanded:bg-gray-300 focus-visible:ring-2 disabled:opacity-50 disabled:cursor-default',
          )}
          isDisabled={!(engine && meta.data)}
        >
          Edit
        </Button>
        <Popover className="w-56 p-1 overflow-auto origin-top-left bg-white rounded shadow-lg ring-1 ring-black ring-opacity-5 entering:animate-in entering:fade-in entering:zoom-in-95 exiting:animate-out exiting:fade-out exiting:zoom-out-95 fill-mode-forwards">
          <Menu
            className="outline-none"
            onAction={(key) => onAction('edit', key as string)}
          >
            <MenuItem id="share">Share</MenuItem>
            <MenuItem id="import">Import</MenuItem>
            {/* <Separator className="bg-gray-300 h-[1px] mx-3 my-1" /> */}
          </Menu>
        </Popover>
      </MenuTrigger>

      {dialog !== null && (
        <DialogContainer onDismiss={() => setDialog(null)}>
          {dialog === 'share' && <MapShareDialog item={meta.data!} />}
          {dialog === 'import' && <ImportDialog mapId={engine!.mapId} />}
        </DialogContainer>
      )}
    </div>
  );
}

function MenuItem(props: ItemProps) {
  return (
    <Item
      {...props}
      className="box-border flex items-center w-full px-2 py-1 text-sm text-gray-900 rounded outline-none cursor-default group focus:bg-neutral-200"
    />
  );
}

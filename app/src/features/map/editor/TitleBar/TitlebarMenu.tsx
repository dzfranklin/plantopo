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

export function TitlebarMenu() {
  const engine = useEngine();
  const [dialog, setDialog] = useState<'import' | null>(null);
  const onAction = (menu: string, key: string) => {
    if (menu === 'edit') {
      if (key === 'new') {
        setDialog('import');
      }
    }
  };

  return (
    <>
      <MenuTrigger>
        <Button
          aria-label="Menu"
          className={cls(
            'mx-1 inline-flex items-center justify-center px-1.5 py-0.5 rounded outline-none text-sm',
            'hover:bg-gray-300 aria-expanded:bg-gray-300 focus-visible:ring-2 disabled:opacity-50 disabled:cursor-default',
          )}
          isDisabled={!engine}
        >
          Edit
        </Button>
        <Popover className="w-56 p-1 overflow-auto origin-top-left bg-white rounded-md shadow-lg ring-1 ring-black ring-opacity-5 entering:animate-in entering:fade-in entering:zoom-in-95 exiting:animate-out exiting:fade-out exiting:zoom-out-95 fill-mode-forwards">
          <Menu
            className="outline-none"
            onAction={(key) => onAction('edit', key as string)}
          >
            <MenuItem id="new">Import</MenuItem>
            {/* <Separator className="bg-gray-300 h-[1px] mx-3 my-1" /> */}
          </Menu>
        </Popover>
      </MenuTrigger>

      {dialog !== null && (
        <DialogContainer onDismiss={() => setDialog(null)}>
          {dialog === 'import' && <ImportDialog mapId={engine!.mapId} />}
        </DialogContainer>
      )}
    </>
  );
}

function MenuItem(props: ItemProps) {
  return (
    <Item
      {...props}
      className="box-border flex items-center w-full px-3 py-2 text-sm text-gray-900 rounded-md outline-none cursor-default group focus:bg-blue-500 focus:text-white"
    />
  );
}

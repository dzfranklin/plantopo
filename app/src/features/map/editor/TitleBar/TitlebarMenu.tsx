import { ImportDialog } from '@/features/importer/ImportDialog';
import cls from '@/generic/cls';
import { DialogContainer } from '@adobe/react-spectrum';
import { useState } from 'react';
import {
  Button as AriaButton,
  Item as AriaItem,
  Menu as AriaMenu,
  MenuTrigger,
  Popover as AriaPopover,
  Separator as AriaSeparator,
  Keyboard as AriaKeyboard,
} from 'react-aria-components';
import type { ItemProps } from 'react-aria-components';
import { useEngine, useKeyBindingsFor } from '../engine/useEngine';
import { MapShareDialog } from '../../MapShareDialog/MapShareDialog';
import { useMapMeta } from '../../api/mapMeta';
import { useMapId } from '../useMapId';
import { KeybindingDisplay } from '../../../keybinding/KeybindingDisplay';
import { EngineCommand } from '../engine/EditorEngine';
import { keyBindingToString } from '../engine/Keymap';

export function TitlebarMenu() {
  const engine = useEngine();
  const mapId = useMapId();
  const meta = useMapMeta(mapId);
  const [dialog, setDialog] = useState<'import' | 'share' | null>(null);

  return (
    <div className="mt-0.5">
      <Menu
        name="Edit"
        isDisabled={!(engine && meta.data)}
        onAction={(id) => {
          switch (id) {
            case 'undo':
              engine?.execute('undo');
              break;
            case 'redo':
              engine?.execute('redo');
              break;
            case 'import':
              setDialog('import');
              break;
            case 'share':
              setDialog('share');
              break;
          }
        }}
      >
        <MenuItem id="undo" cmd="undo">
          Undo
        </MenuItem>
        <MenuItem id="redo" cmd="redo">
          Redo
        </MenuItem>
        <MenuSeparator />
        <MenuItem id="share">Share</MenuItem>
        <MenuItem id="import">Import</MenuItem>
      </Menu>

      <Menu
        name="Tool"
        isDisabled={!engine}
        onAction={(id) => {
          switch (id) {
            case 'line':
              engine?.execute('select-line-tool');
              break;
            case 'point':
              engine?.execute('select-point-tool');
              break;
          }
        }}
      >
        <MenuItem id="line" cmd="select-line-tool">
          Line
        </MenuItem>
        <MenuItem id="point" cmd="select-point-tool">
          Point
        </MenuItem>
      </Menu>

      {dialog !== null && (
        <DialogContainer onDismiss={() => setDialog(null)}>
          {dialog === 'share' && <MapShareDialog item={meta.data!} />}
          {dialog === 'import' && <ImportDialog mapId={engine!.mapId} />}
        </DialogContainer>
      )}
    </div>
  );
}

function Menu({
  isDisabled,
  onAction,
  name,
  children,
}: {
  isDisabled?: boolean;
  onAction: (id: string) => any;
  name: string;
  children: React.ReactNode;
}) {
  return (
    <MenuTrigger>
      <AriaButton
        aria-label="Menu"
        className={cls(
          'mx-1 inline-flex items-center justify-center px-1.5 py-0.5 rounded outline-none text-sm',
          'hover:bg-gray-300 aria-expanded:bg-gray-300 focus-visible:ring-2 disabled:opacity-50 disabled:cursor-default',
        )}
        isDisabled={isDisabled}
      >
        {name}
      </AriaButton>
      <AriaPopover className="w-56 p-1 overflow-auto origin-top-left bg-white rounded shadow-lg ring-1 ring-black ring-opacity-5 entering:animate-in entering:fade-in entering:zoom-in-95 exiting:animate-out exiting:fade-out exiting:zoom-out-95 fill-mode-forwards">
        <AriaMenu
          className="outline-none"
          onAction={(key) => onAction(key as string)}
        >
          {children}
        </AriaMenu>
      </AriaPopover>
    </MenuTrigger>
  );
}

function MenuItem(
  props: ItemProps & { cmd?: EngineCommand; children: React.ReactNode },
) {
  return (
    <AriaItem
      {...props}
      className="box-border flex items-center justify-between w-full px-2 py-1 text-sm text-gray-900 rounded outline-none cursor-default group focus:bg-neutral-200"
    >
      {props.children}
      {props.cmd && <MenuItemKeyBindings cmd={props.cmd} />}
    </AriaItem>
  );
}

function MenuItemKeyBindings({ cmd }: { cmd: EngineCommand }) {
  const bindings = useKeyBindingsFor(cmd);
  return (
    <AriaKeyboard>
      {bindings.map((binding) => (
        <KeybindingDisplay
          key={keyBindingToString(binding)}
          className="text-gray-500"
          binding={binding}
        />
      ))}
    </AriaKeyboard>
  );
}

function MenuSeparator() {
  return <AriaSeparator className="bg-gray-300 h-[1px] mx-1 my-2" />;
}

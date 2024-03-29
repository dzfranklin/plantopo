import { ImportDialog } from '@/features/importer/ImportDialog';
import cls from '@/generic/cls';
import { DialogContainer } from '@adobe/react-spectrum';
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
import {
  useEngine,
  useKeyBindingsFor,
  useStateStatus,
} from '../engine/useEngine';
import { MapShareDialog } from '../../MapShareDialog/MapShareDialog';
import { useMapMeta } from '../../api/mapMeta';
import { useMapId } from '../useMapId';
import { KeybindingDisplay } from '../../../keybinding/KeybindingDisplay';
import { EngineCommand } from '../engine/EditorEngine';
import { keyBindingToString } from '../engine/Keymap';
import { useDebugMode } from '../useDebugMode';
import { useDebugAction, DebugMenu } from './DebugMenu';
import { ExportDialog } from '@/features/exporter/ExportDialog';
import { useState } from 'react';

export function TitlebarMenu({
  focusTitleEdit,
}: {
  focusTitleEdit: () => any;
}) {
  const engine = useEngine();
  const mapId = useMapId();
  const meta = useMapMeta(mapId);
  const [dialog, setDialog] = useState<'import' | 'export' | 'share' | null>(
    null,
  );
  const debugAction = useDebugAction();
  const [debugMode] = useDebugMode();
  const { undoStatus } = useStateStatus();

  return (
    <div className="mt-0.5">
      <Menu
        name="File"
        isDisabled={!(engine && meta.data)}
        onAction={(id) => {
          if (id.startsWith('dbg:')) {
            debugAction(id);
          }
          switch (id) {
            case 'new':
              window.open('/new', '_blank');
              break;
            case 'duplicate':
              window.open(`/new/?copyFrom=${mapId}`, '_blank');
              break;
            case 'rename':
              focusTitleEdit();
              break;
            case 'share':
              setDialog('share');
              break;
            case 'import':
              setDialog('import');
              break;
            case 'export':
              setDialog('export');
              break;
          }
        }}
      >
        <MenuItem id="new">New</MenuItem>
        <MenuItem id="duplicate">Duplicate</MenuItem>
        <MenuItem id="rename">Rename</MenuItem>
        <MenuItem id="share">Share</MenuItem>
        <MenuItem id="import">Import</MenuItem>
        <MenuItem id="export">Export</MenuItem>
        <MenuSeparator />

        {!debugMode ? (
          <MenuItem id="dbg:toggle">Developer mode</MenuItem>
        ) : (
          <>
            <MenuItem id="dbg:toggle">Disable developer mode</MenuItem>
            <DebugMenu />
          </>
        )}
      </Menu>

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
          }
        }}
      >
        <MenuItem id="undo" cmd="undo" disabled={!undoStatus.canUndo}>
          Undo
        </MenuItem>
        <MenuItem id="redo" cmd="redo" disabled={!undoStatus.canRedo}>
          Redo
        </MenuItem>
      </Menu>

      <Menu
        name="Tool"
        isDisabled={!engine}
        onAction={(id) => {
          switch (id) {
            case 'select':
              engine?.execute('use-select-tool');
              break;
            case 'line':
              engine?.execute('use-line-tool');
              break;
            case 'point':
              engine?.execute('use-point-tool');
              break;
          }
        }}
      >
        <MenuItem id="select" cmd="use-select-tool">
          Select
        </MenuItem>
        <MenuItem id="line" cmd="use-line-tool">
          Line
        </MenuItem>
        <MenuItem id="point" cmd="use-point-tool">
          Point
        </MenuItem>
      </Menu>

      {dialog !== null && (
        <DialogContainer onDismiss={() => setDialog(null)}>
          {dialog === 'share' && <MapShareDialog item={meta.data!} />}
          {dialog === 'import' && <ImportDialog mapId={engine!.mapId} />}
          {dialog === 'export' && <ExportDialog mapId={engine!.mapId} />}
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

export function MenuItem(
  props: ItemProps & {
    cmd?: EngineCommand;
    disabled?: boolean;
    children: React.ReactNode;
  },
) {
  return (
    <AriaItem
      {...props}
      className={cls(
        'box-border flex items-center justify-between w-full px-2 py-1',
        'text-sm text-gray-900 rounded outline-none cursor-default group',
        !props.disabled ? 'focus:bg-neutral-200' : 'opacity-60',
      )}
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

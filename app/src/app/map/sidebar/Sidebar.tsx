import cls from '@/app/cls';
import {
  Dispatch,
  DragEventHandler,
  MutableRefObject,
  SetStateAction,
  UIEventHandler,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import AddFeatureIcon from '@spectrum-icons/workflow/Add';
import './Sidebar.css';
import DebugMenu from '../DebugMenu';
import { FInsertPlace, SyncEngine } from '@/sync/SyncEngine';
import { Button, Item, Menu, MenuTrigger } from '@adobe/react-spectrum';
import { EditStartChannel } from '../EditStartChannel';
import { FeatureTree } from './FeatureTree';

export default function Sidebar({
  engine,
  mapName,
  editStart,
}: {
  engine: SyncEngine;
  mapName: string;
  editStart: EditStartChannel;
}) {
  const insertAt = useRef<FInsertPlace>({ at: 'firstChild', target: 0 });

  return (
    <div className="h-screen max-h-screen flex flex-col bg-slate-100">
      <Toolbar
        mapName={mapName}
        engine={engine}
        insertAt={insertAt}
        editStart={editStart}
      />

      <FeatureTree insertAt={insertAt} engine={engine} />
    </div>
  );
}

function Toolbar({
  engine,
  insertAt,
  editStart,
  mapName,
}: {
  engine: SyncEngine;
  insertAt: MutableRefObject<FInsertPlace>;
  editStart: EditStartChannel;
  mapName: string;
}) {
  return (
    <div className="flex p-2 bg-white">
      <div className="flex items-center">
        <DebugMenu engine={engine} />
        <span className="ml-4">{mapName}</span>
      </div>
      <div className="flex items-center justify-end grow">
        <MenuTrigger>
          <Button variant="accent">
            <AddFeatureIcon />
          </Button>
          <Menu
            onAction={(key) => {
              switch (key) {
                case 'folder':
                  engine.fCreate(insertAt.current);
                  break;
                case 'route':
                  editStart.emit({
                    type: 'createRoute',
                    insertAt: { ...insertAt.current },
                  });
                  break;
                default:
                  throw new Error('Unreachable');
              }
            }}
          >
            <Item key="folder">New folder</Item>
          </Menu>
        </MenuTrigger>
      </div>
    </div>
  );
}

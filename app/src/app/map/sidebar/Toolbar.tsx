import { MutableRefObject } from 'react';
import AddFeatureIcon from '@spectrum-icons/workflow/Add';
import DebugMenu from '../DebugMenu';
import { FInsertPlace, SyncEngine } from '@/sync/SyncEngine';
import { Button, Item, Menu, MenuTrigger } from '@adobe/react-spectrum';
import { EditStartChannel } from '../EditStartChannel';

export function Toolbar({
  engine,
  insertAt,
  editStart,
  mapName,
  width,
}: {
  engine: SyncEngine;
  insertAt: MutableRefObject<FInsertPlace>;
  editStart: EditStartChannel;
  mapName: string;
  width: number;
}) {
  return (
    <div className="flex min-w-0 p-2 bg-white">
      {width > 10 && (
        <div className="flex items-center min-w-0 truncate">
          <DebugMenu engine={engine} />
          <span className="ml-4 truncate ">{mapName}</span>
        </div>
      )}
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

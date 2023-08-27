import { ActionButton, Item, Menu, MenuTrigger } from '@adobe/react-spectrum';
import DebugMenuIcon from '@spectrum-icons/workflow/Bug';
import { useCallback } from 'react';
import { SyncEngine } from './api/SyncEngine';
import { SyncSocket } from './api/SyncSocket';

export default function DebugMenu({
  engine,
  socket,
}: {
  engine: SyncEngine;
  socket: SyncSocket;
}) {
  const onAction = useCallback(
    (key: string | number) => {
      switch (key) {
        case 'logUpdateSummary': {
          engine.logUpdateSummary();
          break;
        }
        case 'assignEngine': {
          (window as any)['engine'] = engine;
          console.info('Assigned to window.engine');
          break;
        }
        case 'logSocketState':
          socket.logState();
          break;
        case 'assignSocket':
          (window as any)['socket'] = socket;
          console.info('Assigned to window.socket');
          break;
      }
    },
    [engine, socket],
  );

  return (
    <MenuTrigger>
      <ActionButton
        aria-label="open debug menu"
        UNSAFE_style={{ minWidth: 0, border: 'none' }}
      >
        <DebugMenuIcon
          UNSAFE_style={{
            paddingLeft: '2px',
            paddingRight: '2px',
            width: '12px',
          }}
        />
      </ActionButton>

      <Menu onAction={onAction}>
        <Item key="logUpdateSummary">Log update summary</Item>
        <Item key="assignEngine">Assign engine to global</Item>
        <Item key="logSocketState">Log socket state</Item>
        <Item key="assignSocket">Assign socket to global</Item>
      </Menu>
    </MenuTrigger>
  );
}

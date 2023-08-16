import { SyncSocket } from '@/sync/SyncSocket';
import { ActionButton, Item, Menu, MenuTrigger } from '@adobe/react-spectrum';
import OpenDebugMenuIcon from '@spectrum-icons/workflow/MoreVertical';
import { useCallback } from 'react';

export default function DebugMenu({ socket }: { socket: SyncSocket }) {
  const onAction = useCallback(
    (key: string | number) => {
      switch (key) {
        case 'logUpdateSummary': {
          socket.logUpdateSummary();
          break;
        }
      }
    },
    [socket],
  );

  return (
    <MenuTrigger>
      <ActionButton aria-label="open debug menu">
        <OpenDebugMenuIcon />
      </ActionButton>

      <Menu onAction={onAction}>
        <Item key="logUpdateSummary">Log update summary</Item>
      </Menu>
    </MenuTrigger>
  );
}

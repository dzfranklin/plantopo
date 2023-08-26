import { SyncEngine } from '@/api/map/sync/SyncEngine';
import { ActionButton, Item, Menu, MenuTrigger } from '@adobe/react-spectrum';
import DebugMenuIcon from '@spectrum-icons/workflow/Bug';
import { useCallback } from 'react';

export default function DebugMenu({ engine }: { engine: SyncEngine }) {
  const onAction = useCallback(
    (key: string | number) => {
      switch (key) {
        case 'logUpdateSummary': {
          engine.logUpdateSummary();
          break;
        }
        case 'assignEngine': {
          (window as any)['tempEngine'] = engine;
          console.info('Assigned to window.tempEngine');
          break;
        }
      }
    },
    [engine],
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
      </Menu>
    </MenuTrigger>
  );
}

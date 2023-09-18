import { ActionButton, Item, Menu, MenuTrigger } from '@adobe/react-spectrum';
import DebugMenuIcon from '@spectrum-icons/workflow/Bug';
import { useCallback } from 'react';

export default function DebugMenu() {
  const onAction = useCallback((key: string | number) => {
    switch (key) {
      default:
        return;
    }
  }, []);

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
        <Item key="todo">TODO: </Item>
      </Menu>
    </MenuTrigger>
  );
}

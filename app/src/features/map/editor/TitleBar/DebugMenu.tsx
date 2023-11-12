import { Dispatch } from 'react';
import { MenuItem } from './TitlebarMenu';
import { useDebugMode } from '../useDebugMode';
import { useEngine } from '../engine/useEngine';

export function useDebugAction(): Dispatch<string> {
  const engine = useEngine();
  const [_, setDebug] = useDebugMode();
  return (action: string) => {
    switch (action) {
      case 'dbg:toggle':
        setDebug((p) => !p);
        break;
      case 'dbg:local-export':
        engine?.executeDbg('local-export');
        break;
    }
  };
}

export function DebugMenu() {
  return <MenuItem id="dbg:local-export">Local export</MenuItem>;
}

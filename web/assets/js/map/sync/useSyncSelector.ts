import { useContext, useEffect, useState } from 'react';
import { SyncState } from './types';
import SyncContext from './SyncContext';
import useSync from './useSync';

export default function useSyncSelector<T>(
  selector: (state: SyncState) => T,
): T {
  const ctx = useSync();

  const [value, setValue] = useState<T>(() => selector(ctx.state()));

  useEffect(() => {
    const listener = (state: SyncState) => setValue(selector(state));
    ctx.addStateListener(listener);
    return () => ctx.removeStateListener(listener);
  }, [ctx, selector]);

  return value;
}

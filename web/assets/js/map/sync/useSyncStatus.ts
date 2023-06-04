import { useContext, useEffect, useState } from 'react';
import SyncContext from './SyncContext';
import { SyncStatus } from './types';

export default function useSyncStatus(): SyncStatus {
  const ctx = useContext(SyncContext)!;

  const [value, setValue] = useState(() => ctx.socketStatus());

  useEffect(() => {
    const listener = (value: SyncStatus) => setValue(value);
    ctx.addStatusListener(listener);
    return () => ctx.removeStatusListener(listener);
  }, [ctx]);

  return value;
}

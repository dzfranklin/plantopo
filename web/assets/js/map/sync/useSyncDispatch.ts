import { useCallback, useContext } from 'react';
import SyncContext from './SyncContext';

export default function useSyncDispatch(): (action: object) => object {
  const ctx = useContext(SyncContext)!;
  return useCallback((action: object) => ctx.dispatch(action), [ctx]);
}

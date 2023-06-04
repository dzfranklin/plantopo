import { useContext } from 'react';
import SyncContext from './SyncContext';

export default function useSync() {
  const value = useContext(SyncContext);
  if (value === null) {
    throw new Error('useSync: no SyncContext provided');
  } else {
    return value;
  }
}

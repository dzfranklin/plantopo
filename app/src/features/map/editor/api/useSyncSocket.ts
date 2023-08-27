import { useEffect, useState } from 'react';
import { SyncSocket, SyncSocketState } from './SyncSocket';

export function useSyncSocket(mapId: number) {
  const [socket, setSocket] = useState<SyncSocket | null>(null);
  const [state, setState] = useState<SyncSocketState>({ status: 'opening' });
  useEffect(() => {
    const socket = new SyncSocket(mapId);
    socket.addStateListener(setState);
    setSocket(socket);
    return () => socket.close();
  }, [mapId]);
  return {
    status: state.status,
    engine: 'engine' in state ? state.engine : null,
    state,
    socket,
  };
}

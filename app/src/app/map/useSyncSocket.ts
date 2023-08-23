import { SyncEngine } from '@/sync/SyncEngine';
import { SyncSocket } from '@/sync/SyncSocket';
import { useEffect, useRef, useState } from 'react';

export function useSyncSocket(mapId: number): {
  error?: Error;
  engine?: SyncEngine;
} {
  const socketRef = useRef<SyncSocket | null>(null);
  const [engine, setEngine] = useState<SyncEngine | undefined>(undefined);
  const [error, setError] = useState<Error | undefined>(undefined);
  useEffect(() => {
    if (mapId === null) return;
    if (socketRef.current && socketRef.current.mapId === mapId) return;
    const socket = new SyncSocket({
      mapId,
      onConnect: setEngine,
      onError: setError,
      domain: location.host,
      secure: location.protocol !== 'http:',
    });
    console.log('Created socket', socket);
    socket.connect();
    socketRef.current = socket;
    () => socket.close();
  }, [mapId]);

  return { error, engine };
}

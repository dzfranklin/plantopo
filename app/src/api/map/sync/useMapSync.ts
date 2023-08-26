import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { SyncEngine } from './SyncEngine';
import { MapSyncAuthorization } from './MapSyncAuthorization';
import { SyncSocket } from './SyncSocket';
import { handleResp } from '../../support';

async function fetchSyncAuthorization(
  id: number,
): Promise<MapSyncAuthorization> {
  return handleResp(
    fetch(`/api/map/authorize_sync?id=${id}`, {
      method: 'POST',
    }),
  );
}

export function useMapSync(
  mapId: number,
  { onError }: { onError?: (error: Error) => any } = {},
): {
  error: Error | null;
  engine: SyncEngine | null;
  reconnectingAt: number | null;
} {
  const [authz, setAuthz] = useState<MapSyncAuthorization | null>(null);
  const [engine, setEngine] = useState<SyncEngine | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [reconnectingAt, setReconnectingAt] = useState<number | null>(null);

  useQuery({
    queryKey: ['map', mapId, 'syncAuthorization'],
    queryFn: () => fetchSyncAuthorization(mapId),
    onSuccess: setAuthz,
    onError: (resp) => {
      const error = resp instanceof Error ? resp : new Error(`${resp}`);
      onError?.(error);
      setError((p) => p || error);
    },
  });

  useEffect(() => {
    if (authz) {
      const socket = new SyncSocket({
        authorization: authz,
        onConnect: setEngine,
        onConnectFail: setReconnectingAt,
        onError: (error) => {
          console.warn(error);
          setError((p) => p || error);
        },
      });
      console.log('Created socket', socket);
      socket.connect();
      return () => socket.close();
    }
  }, [mapId, authz]);

  return { engine, error, reconnectingAt };
}

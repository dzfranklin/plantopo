import { useMutation, useQueryClient } from '@tanstack/react-query';
import { MapMeta } from './MapMeta';
import { respToError } from '@/api/support';

export interface MapCreateParams {
  name?: string;
  generalAccessLevel?: 'restricted' | 'public';
  generalAccessRole?: 'viewer' | 'editor';
}

async function sendMapCreate(params: MapCreateParams): Promise<MapMeta> {
  const resp = await fetch('/api/map/create', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(params),
  });
  if (resp.ok) {
    return await resp.json();
  } else {
    throw await respToError(resp);
  }
}

export function useMapCreateMutation({
  onSuccess,
}: { onSuccess?: (_: MapMeta) => void } = {}) {
  const client = useQueryClient();
  return useMutation({
    mutationKey: ['map', 'create'],
    mutationFn: (params: MapCreateParams) => sendMapCreate(params),
    onSuccess: async (data) => {
      client.invalidateQueries(['map', 'ownedByMe', 'meta']);
      onSuccess?.(data);
    },
  });
}

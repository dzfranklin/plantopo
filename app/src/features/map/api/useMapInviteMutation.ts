import { useMutation, useQueryClient } from '@tanstack/react-query';
import { respToError } from '@/api/support';
import { UserAccessRole } from './MapAccess';

export interface MapInviteParams {
  mapId: number;
  email: string;
  role: UserAccessRole;
  notify: boolean;
  notifyMessage?: string;
}

async function sendMapInvite(params: MapInviteParams): Promise<void> {
  const resp = await fetch('/api/map/invite', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(params),
  });
  if (!resp.ok) {
    throw await respToError(resp);
  }
}

export function useMapInviteMutation({
  onSuccess,
}: { onSuccess?: () => any } = {}) {
  const client = useQueryClient();
  return useMutation({
    mutationKey: ['mapInvite'],
    mutationFn: sendMapInvite,
    onSuccess: (_data, params) => {
      client.invalidateQueries(['map', params.mapId, 'access']);
      onSuccess?.();
    },
  });
}

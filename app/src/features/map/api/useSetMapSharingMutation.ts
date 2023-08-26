import {
  UseMutationResult,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';
import { PutMapAccess } from './MapAccess';
import { respToError } from '@/api/support';

async function sendPutMapAccess(params: PutMapAccess): Promise<void> {
  const resp = await fetch('/api/map/access', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(params),
  });
  if (!resp.ok) {
    throw await respToError(resp);
  }
}

export function useSetMapSharingMutation(
  id: number,
  { onSuccess }: { onSuccess?: () => void } = {},
): UseMutationResult<void, unknown, Omit<PutMapAccess, 'id'>> {
  const client = useQueryClient();
  return useMutation({
    mutationKey: ['map', id, 'setSharing'],
    mutationFn: (params) => sendPutMapAccess({ ...params, id: id }),
    onSuccess: () => {
      client.invalidateQueries(['map', id, 'sharing']);
      onSuccess?.();
    },
  });
}

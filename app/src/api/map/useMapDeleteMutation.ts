import { useMutation, useQueryClient } from '@tanstack/react-query';
import { respToError } from '../support';

async function sendMapDelete(maps: number[]): Promise<void> {
  const resp = await fetch('/api/map', {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ maps }),
  });
  if (!resp.ok) {
    throw await respToError(resp);
  }
}

export function useMapDeleteMutation({
  onSuccess,
}: {
  onSuccess?: () => void;
} = {}) {
  const client = useQueryClient();
  return useMutation({
    mutationKey: ['map', 'delete'],
    mutationFn: sendMapDelete,
    onSuccess: () => {
      client.invalidateQueries(['map']);
      onSuccess?.();
    },
  });
}

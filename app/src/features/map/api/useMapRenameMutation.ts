import { useMutation, useQueryClient } from '@tanstack/react-query';
import { respToError } from '@/api/support';

async function sendMapRename(id: number, name: string): Promise<void> {
  const resp = await fetch(`/api/map/rename?id=${id}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ name }),
  });
  if (!resp.ok) {
    throw await respToError(resp);
  }
}

export function useMapRenameMutation(
  id: number,
  { onSuccess }: { onSuccess?: () => void } = {},
) {
  const client = useQueryClient();
  return useMutation({
    mutationKey: ['map', id, 'mutateName'],
    mutationFn: async (name: string) => {
      await sendMapRename(id, name);
    },
    onSuccess: () => {
      client.invalidateQueries(['map', id, 'meta']);
      client.invalidateQueries(['map', 'viewableByMe', 'meta']);
      client.invalidateQueries(['map', 'ownedByMe', 'meta']);
      onSuccess?.();
    },
  });
}

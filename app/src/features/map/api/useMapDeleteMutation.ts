import { useQueryClient } from '@tanstack/react-query';
import { useApiMutation } from '@/api/useApiMutation';
import { deleteQueryDataFromMapsOwnedByMe } from './mapList';
import { mapKey } from './mapMeta';

interface MapDeleteRequest {
  list: string[];
}

export function useMapDeleteMutation() {
  const client = useQueryClient();
  return useApiMutation<void, unknown, MapDeleteRequest>({
    path: ['map'],
    method: 'DELETE',
    onSuccess: (_data, variables) => {
      deleteQueryDataFromMapsOwnedByMe(client, variables.list);
      for (const mapId of variables.list) {
        client.invalidateQueries(mapKey(mapId));
      }
    },
  });
}

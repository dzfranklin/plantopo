import { useQueryClient } from '@tanstack/react-query';
import { MapMeta } from './mapMeta';
import { apiMutationKey, useApiMutation } from '@/api/useApiMutation';
import { mapsOwnedByMeKey } from './mapList';

const CREATE_PATH = ['map'];

export function useMapCreateMutation({
  onSuccess,
}: {
  onSuccess?: (data: MapMeta) => void;
}) {
  const client = useQueryClient();
  return useApiMutation<MapMeta, unknown, void>({
    path: CREATE_PATH,
    onSuccess: async (data) => {
      client.invalidateQueries(mapsOwnedByMeKey);
      onSuccess?.(data);
    },
  });
}

export const mapCreateKey = apiMutationKey({ path: CREATE_PATH });

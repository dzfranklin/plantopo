import { apiQueryKey, useApiQuery } from '@/api/useApiQuery';
import { MapMeta } from './mapMeta';
import { QueryClient } from '@tanstack/react-query';

interface ListReply {
  items: MapMeta[];
}

const OWNED_BY_ME_PATH = ['map', 'list', 'owned-by-me'];

export const useMapsOwnedByMe = () =>
  useApiQuery<MapMeta[], unknown>({
    path: OWNED_BY_ME_PATH,
    mapData: (data) => (data as ListReply).items,
  });

export const mapsOwnedByMeKey = apiQueryKey({ path: OWNED_BY_ME_PATH });

const SHARE_WITH_ME_PATH = ['map', 'list', 'shared-with-me'];

export const useMapsSharedWithMe = () =>
  useApiQuery<MapMeta[], unknown>({
    path: SHARE_WITH_ME_PATH,
    mapData: (data) => (data as ListReply).items,
  });

export const mapsSharedWithMeKey = apiQueryKey({ path: SHARE_WITH_ME_PATH });

export function deleteQueryDataFromMapsOwnedByMe(
  queryClient: QueryClient,
  ids: string[],
) {
  queryClient.setQueryData<MapMeta[]>(mapsOwnedByMeKey, (old) => {
    if (!old) return old;
    return old.filter((m) => !ids.includes(m.id));
  });
}

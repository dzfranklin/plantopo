import { useQueryClient } from '@tanstack/react-query';
import { apiQueryKey, useApiQuery } from '@/api/useApiQuery';
import {
  MapAccess,
  PutMapAccessRequest,
  RequestMapAccessRequest,
} from './MapAccess';
import { useApiMutation } from '@/api/useApiMutation';
import { mapsOwnedByMeKey, mapsSharedWithMeKey } from './mapList';
import { AppError } from '@/api/errors';

export interface MapMeta {
  id: string;
  name: string;
  createdAt: string;
  currentSessionMayEdit: boolean;
}

export interface PutMapMetaRequest {
  name?: string;
}

export const mapKey = (id: string) => apiQueryKey({ path: ['map', id] });

export const useMapMeta = (id: string) =>
  useApiQuery<MapMeta, unknown>({
    path: ['map', id],
  });

export const useMaybeMapMeta = (id: string) =>
  useApiQuery<MapMeta, unknown>({
    path: ['map', id],
    retry: (failureCount, error) => {
      if (error instanceof AppError) {
        if (error.code > 400 && error.code < 500) {
          return false;
        }
      }
      return failureCount < 3;
    },
  });

export function usePutMapMetaMutation(
  id: string,
  { onSuccess }: { onSuccess?: (data: MapMeta) => any } = {},
) {
  const client = useQueryClient();
  return useApiMutation<MapMeta, unknown, PutMapMetaRequest>({
    path: ['map', id],
    method: 'PUT',
    onSuccess: (data) => {
      const key = mapKey(id);
      client.setQueryData(key, data);
      for (const listKey of [mapsOwnedByMeKey, mapsSharedWithMeKey]) {
        client.setQueryData(
          listKey,
          (old?: MapMeta[]) => old?.map((m) => (m.id === id ? data : m)),
        );
      }
      onSuccess?.(data);
    },
  });
}

export const useMapAccess = (id: string) =>
  useApiQuery<MapAccess, unknown>({
    path: ['map', id, 'access'],
  });

export function usePutMapAccessMutation(
  id: string,
  { onSuccess }: { onSuccess?: (data: MapAccess) => any } = {},
) {
  const client = useQueryClient();
  return useApiMutation<MapAccess, unknown, PutMapAccessRequest>({
    path: ['map', id, 'access'],
    method: 'PUT',
    onSuccess: (data) => {
      const key = apiQueryKey({ path: ['map', id, 'access'] });
      client.setQueryData(key, data);
      onSuccess?.(data);
    },
  });
}

export const useRequestMapAccessMutation = (id: string) =>
  useApiMutation<void, void, RequestMapAccessRequest>({
    path: ['map', id, 'access', 'request'],
    method: 'POST',
  });

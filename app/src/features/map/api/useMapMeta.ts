import { UseQueryResult, useQuery } from '@tanstack/react-query';
import { MapMeta } from './MapMeta';
import { handleResp } from '@/api/support';

export async function fetchMapMeta(id: number): Promise<MapMeta> {
  return handleResp(fetch(`/api/map/meta?id=${id}`));
}

export function useMapMeta(id: number): UseQueryResult<MapMeta> {
  return useQuery(['map', id, 'meta'], () => fetchMapMeta(id));
}

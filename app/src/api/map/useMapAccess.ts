import { UseQueryResult, useQuery } from '@tanstack/react-query';
import { MapAccess } from './MapAccess';
import { handleResp } from '../support';

async function fetchMapAccess(id: number): Promise<MapAccess> {
  return handleResp(fetch(`/api/map/access?id=${id}`));
}

export function useMapAccess(id: number): UseQueryResult<MapAccess> {
  return useQuery(['map', id, 'access'], () => fetchMapAccess(id));
}

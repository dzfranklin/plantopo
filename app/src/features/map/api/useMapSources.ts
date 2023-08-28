import { handleResp } from '@/api/support';
import { UseQueryResult, useQuery } from '@tanstack/react-query';
import { MapSources } from '../editor/api/mapSources';

async function fetchMapSources(): Promise<MapSources> {
  return handleResp(fetch('/mapSources.json'));
}

export function useMapSources(): UseQueryResult<MapSources> {
  return useQuery({
    queryKey: ['mapSources.json'],
    queryFn: fetchMapSources,
    staleTime: Infinity,
  });
}

import { handleResp } from '@/api/support';
import { UseQueryResult, useQuery } from '@tanstack/react-query';

export interface TokenValues {
  mapbox: string;
  os: string;
  maptiler: string;
}

const fetchTokens = () => handleResp(fetch('/api/map/tokens'));

export function useTokens(): UseQueryResult<TokenValues> {
  return useQuery({
    queryKey: ['tokens'],
    queryFn: fetchTokens,
    staleTime: Infinity,
  });
}

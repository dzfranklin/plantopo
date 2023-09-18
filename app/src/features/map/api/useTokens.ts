import { useApiQuery } from '@/api/useApiQuery';

export interface TokenValues {
  mapbox: string;
  os: string;
  maptiler: string;
}

export const useTokensQuery = () =>
  useApiQuery<TokenValues>({
    path: ['map', 'tokens'],
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });

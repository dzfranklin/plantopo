import { $api } from '@/api/client';

export function useElevationQuery(coordinates: [number, number][]) {
  return $api.useQuery(
    'post',
    '/elevation',
    { body: { coordinates } },
    { staleTime: Infinity },
  );
}

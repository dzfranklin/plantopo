import { useQuery } from '@tanstack/react-query';
import { handleResp } from '@/api/support';
import { MapMeta } from './MapMeta';

async function fetchMapsSharedWithMe(): Promise<MapMeta[]> {
  return handleResp(fetch('/api/map/shared_with_me'));
}

export function useMapsSharedWithMe() {
  return useQuery(['map', 'sharedWithMe', 'meta'], fetchMapsSharedWithMe);
}

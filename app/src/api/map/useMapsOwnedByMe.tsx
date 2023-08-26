import { handleResp } from '../support';
import { MapMeta } from './MapMeta';
import { useQuery } from '@tanstack/react-query';

async function fetchMapsOwnedByMe(): Promise<MapMeta[]> {
  return handleResp(fetch('/api/map/owned_by_me'));
}

export function useMapsOwnedByMe() {
  return useQuery(['map', 'ownedByMe', 'meta'], fetchMapsOwnedByMe);
}

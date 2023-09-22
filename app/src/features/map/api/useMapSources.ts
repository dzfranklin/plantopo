import { MapSources } from '../editor/api/mapSources';
import staticMapSources from '@/gen/mapSources.json';

export const useMapSources = (): MapSources =>
  staticMapSources as unknown as MapSources;

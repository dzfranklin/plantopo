import { UseQueryResult, useQuery } from '@tanstack/react-query';
import { LayerDatas, LayerSources } from './layers/types';

export interface Resources {
  layerData: LayerDatas;
  layerSource: LayerSources;
}

export default function useResources(): UseQueryResult<Resources, unknown> {
  return useQuery({
    queryKey: ['resources'],
    queryFn: async () => (await fetch('/api/resources.json')).json(),
  });
}

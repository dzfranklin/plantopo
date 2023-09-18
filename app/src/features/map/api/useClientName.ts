import { handleResp } from '@/api/support';
import { UseQueryResult, useQuery } from '@tanstack/react-query';

interface Resp {
  name: string;
}

async function fetchClientName(clientId: string): Promise<string> {
  const resp: Resp = await handleResp(
    fetch(`/api/map/sync_client_name?id=${encodeURIComponent(clientId)}`),
  );
  return resp.name;
}

export function useClientName(clientId: string): UseQueryResult<string> {
  return useQuery({
    queryKey: ['sync_client_name', clientId],
    queryFn: () => fetchClientName(clientId),
    staleTime: Infinity,
  });
}

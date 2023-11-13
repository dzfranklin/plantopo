import { useApiMutation } from '@/api/useApiMutation';

interface ExportMapRequest {
  format: string;
}

interface ExportMapResponse {
  url: string;
}

export function useExportMapMutation(mapId: string) {
  return useApiMutation<ExportMapResponse, unknown, ExportMapRequest>({
    method: 'POST',
    path: ['map', mapId, 'export'],
  });
}

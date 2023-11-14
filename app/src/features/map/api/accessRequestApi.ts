import { apiQueryKey, useApiQuery } from '@/api/useApiQuery';
import { UserAccessRole } from './MapAccess';
import { useApiMutation } from '@/api/useApiMutation';
import { useQueryClient } from '@tanstack/react-query';

export interface PendingAccessRequest {
  id: string;
  createdAt: string;
  requestingUserEmail: string;
  requestingUserFullName: string;
  mapId: string;
  mapName: string;
  requestedRole: UserAccessRole;
  message: string;
}

export const usePendingAccessRequests = () =>
  useApiQuery<PendingAccessRequest[], unknown>({
    path: ['access-request', 'pending'],
  });

const pendingKey = apiQueryKey({ path: ['access-request', 'pending'] });

export const useApproveAccessRequestMutation = (id: string) => {
  const client = useQueryClient();
  return useApiMutation<void, unknown, void>({
    path: ['access-request', id, 'approve'],
    method: 'POST',
    onSuccess: () => {
      client.invalidateQueries(pendingKey);
    },
  });
};
export const useRejectAccessRequestMutation = (id: string) => {
  const client = useQueryClient();
  return useApiMutation<void, unknown, void>({
    path: ['access-request', id, 'reject'],
    method: 'POST',
    onSuccess: () => {
      client.invalidateQueries(pendingKey);
    },
  });
};

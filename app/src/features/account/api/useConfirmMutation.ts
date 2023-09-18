import { useApiMutation } from '@/api/useApiMutation';
import { useQueryClient } from '@tanstack/react-query';
import { Session, overrideSession } from '../session';

interface ConfirmCompleteRequest {
  token: string;
}

export function useConfirmCompleteMutation() {
  const queryClient = useQueryClient();
  return useApiMutation<Session, void, ConfirmCompleteRequest>({
    path: ['account', 'confirm', 'complete'],
    onSuccess: (data) => overrideSession(queryClient, data),
  });
}

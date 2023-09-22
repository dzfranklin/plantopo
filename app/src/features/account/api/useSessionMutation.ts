import { Session, clearCachedSession, overrideSession } from '../session';
import { useApiMutation } from '@/api/useApiMutation';
import { useQueryClient } from '@tanstack/react-query';

export const useLogoutMutation = () =>
  useApiMutation<Session, undefined, void>({
    method: 'DELETE',
    path: ['session'],
    onSuccess: () => {
      // Do a clean redirect so we can't accidentally preserve any state.
      clearCachedSession();
      location.href = '/';
    },
  });

interface CreateSessionRequest {
  email: string;
  password: string;
}

interface LoginIssue {
  email?: string;
  password?: string;
}

export function useCreateSessionMutation() {
  const queryClient = useQueryClient();
  return useApiMutation<Session, LoginIssue, CreateSessionRequest>({
    method: 'POST',
    path: ['session'],
    onSuccess: (value) => overrideSession(queryClient, value),
  });
}

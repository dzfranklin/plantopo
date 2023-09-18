import { useApiMutation } from '@/api/useApiMutation';
import { User } from './User';
import { useApiQuery } from '@/api/useApiQuery';
import { Session, overrideSession } from '../session';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';

interface RequestPasswordResetRequest {
  email: string;
}

export const usePasswordResetRequestMutation = () =>
  useApiMutation<void, unknown, RequestPasswordResetRequest>({
    path: ['account', 'password-reset', 'request'],
  });

interface PasswordResetCheckReply {
  user: User;
}

export const usePasswordResetCheckQuery = (token: string) =>
  useApiQuery<PasswordResetCheckReply, unknown>({
    method: 'POST',
    path: ['account', 'password-reset', 'check'],
    body: { token },
    retry: false,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });

interface PasswordResetCompleteRequest {
  token: string;
  password: string;
}

interface PasswordResetIssue {
  password?: string;
}

export function usePasswordResetCompleteMutation() {
  const queryClient = useQueryClient();
  const router = useRouter();
  return useApiMutation<
    Session,
    PasswordResetIssue,
    PasswordResetCompleteRequest
  >({
    path: ['account', 'password-reset', 'complete'],
    onSuccess: (data) => {
      overrideSession(queryClient, data);
      router.replace('/');
    },
  });
}

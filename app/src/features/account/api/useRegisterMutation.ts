import { useQueryClient } from '@tanstack/react-query';
import { Session, overrideSession } from '../session';
import { useApiMutation } from '@/api/useApiMutation';

interface RegisterRequest {
  email: string;
  fullName: string;
  password: string;
}

interface RegistrationIssue {
  email?: string;
  fullName?: string;
  password?: string;
}

export function useRegisterMutation() {
  const queryClient = useQueryClient();
  return useApiMutation<Session, RegistrationIssue, RegisterRequest>({
    method: 'POST',
    path: ['account', 'register'],
    onSuccess: (data) => overrideSession(queryClient, data),
  });
}

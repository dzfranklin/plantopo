import { useApiMutation } from '@/api/useApiMutation';

interface RerequestConfirmationRequest {
  email: string;
}

export const useRerequestConfirmationMutation = () =>
  useApiMutation<void, unknown, RerequestConfirmationRequest>({
    path: ['account', 'confirm', 'rerequest'],
  });

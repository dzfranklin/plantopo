import { useMutation } from '@tanstack/react-query';
import { sendLogout } from './sendLogout';

export function useLogoutMutation() {
  return useMutation({
    mutationKey: ['account', 'logout'],
    mutationFn: sendLogout,
    onSuccess: () => {
      // I deliberately do a clean refresh here to clean things like the cookie
      location.href = '/';
    },
  });
}

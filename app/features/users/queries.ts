import { $api } from '@/api/client';
import { User } from '@/features/users/schema';

export function useUserID(): string | null {
  const query = $api.useQuery(
    'post',
    '/auth/check',
    {},
    { throwOnError: false, retry: false },
  );
  return query.data?.userID ?? null;
}

export function useUser(): User | null {
  const query = $api.useQuery(
    'get',
    '/auth/me',
    {},
    { throwOnError: false, retry: false },
  );
  return query.data?.user ?? null;
}

export function useLogoutMutation() {
  return $api.useMutation('post', '/auth/revoke-browser', {
    onSuccess: () => {
      location.href = '/';
    },
  });
}

import { useCallback, useEffect } from 'react';
import { User } from '@/features/account/api/User';
import { useApiQuery } from '@/api/useApiQuery';
import { QueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { TransportError } from '@/api/errors';

export type Session = { user: User };

type NoSession = { user: null };

export function useSession({
  require,
}: {
  require?: boolean;
} = {}): Session | null {
  const redirector = useSessionRedirector();

  const query = useApiQuery<Session | NoSession>({
    path: ['session'],
    retry: (failureCount, error) =>
      error instanceof TransportError && failureCount < 3,
  });

  useEffect(() => {
    if (require && query.data && !query.data.user) {
      redirector();
    }
  }, [require, redirector, query.data]);

  if (query.isSuccess && query.data.user) {
    return query.data;
  } else {
    return null;
  }
}

export function useSessionRedirector(): () => void {
  const router = useRouter();
  return useCallback(() => {
    const returnTo = location.pathname + location.search + location.hash;
    router.replace(`/login?returnTo=${encodeURIComponent(returnTo)}`);
  }, [router]);
}

export const overrideSession = (
  queryClient: QueryClient,
  session: Session,
  updatedAt: number = Date.now(),
) => {
  queryClient.setQueryData(['session'], session, { updatedAt });
  console.log('session overridden to', session);
};

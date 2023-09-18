import {
  ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
} from 'react';
import { User } from '@/features/account/api/User';
import { useApiQuery } from '@/api/useApiQuery';
import { QueryClient, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { TransportError } from '@/api/errors';

export type Session = { user: User };

type NoSession = { user: null };

type SessionValue =
  | { status: 'beforeLoad' }
  | { status: 'loaded'; value: Session | null };

const SessionContext = createContext<SessionValue>({ status: 'beforeLoad' });

export function useSession({
  require,
}: {
  require?: boolean;
} = {}): Session | null {
  const redirector = useSessionRedirector();
  const value = useContext(SessionContext);
  useEffect(() => {
    if (require && value.status === 'loaded' && !value.value) {
      redirector();
    }
  }, [require, redirector, value]);
  if (value.status === 'beforeLoad') {
    return null;
  } else {
    return value.value;
  }
}

export function useSessionRedirector(): () => void {
  const router = useRouter();
  return useCallback(() => {
    const returnTo = location.pathname + location.search + location.hash;
    router.replace(`/login?returnTo=${encodeURIComponent(returnTo)}`);
  }, [router]);
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const client = useQueryClient();

  useEffect(() => {
    const value = window.localStorage.getItem('session');
    if (value) {
      const stored: { value: Session; updatedAt: number } = JSON.parse(value);
      client.setQueryData(['session'], stored.value, {
        updatedAt: stored.updatedAt,
      });
    }
  }, [client]);

  const query = useApiQuery<Session | NoSession>({
    path: ['session'],
    retry: (failureCount, error) =>
      error instanceof TransportError && failureCount < 3,
  });

  let value: Session | null = null;
  if (query.isSuccess && query.data.user) {
    value = query.data;
  }

  useEffect(() => {
    if (value) {
      setCachedSession(value, query.dataUpdatedAt);
    } else {
      clearCachedSession();
    }
  }, [value, query.dataUpdatedAt]);

  return (
    <SessionContext.Provider
      value={
        query.isInitialLoading
          ? { status: 'beforeLoad' }
          : { status: 'loaded', value }
      }
    >
      {children}
    </SessionContext.Provider>
  );
}

export const clearCachedSession = () => {
  window.localStorage.removeItem('session');
};

const setCachedSession = (session: Session, updatedAt: number) =>
  window.localStorage.setItem(
    'session',
    JSON.stringify({
      value: session,
      updatedAt,
    }),
  );

export const overrideSession = (
  queryClient: QueryClient,
  session: Session,
  updatedAt: number = Date.now(),
) => {
  setCachedSession(session, updatedAt);
  queryClient.setQueryData(['session'], session);
  console.log('session overridden to', session);
};

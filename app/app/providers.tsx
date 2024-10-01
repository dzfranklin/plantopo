'use client';

// Since QueryClientProvider relies on useContext under the hood, we have to put 'use client' on top
import {
  isServer,
  QueryCache,
  QueryClient,
  QueryClientProvider,
} from '@tanstack/react-query';
import { ReactNode } from 'react';
import { Toaster, toast } from 'react-hot-toast';
import { DebugModeProvider } from '@/hooks/debugMode';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';

function toastErr(err: unknown) {
  let msg;
  if (
    typeof err === 'object' &&
    err !== null &&
    'message' in err &&
    typeof err.message === 'string' &&
    err.message !== ''
  ) {
    msg = err.message;
  } else if (typeof err === 'string') {
    msg = err;
  } else {
    msg = 'An error has occurred';
  }
  toast.error(msg);
}

function makeQueryClient() {
  return new QueryClient({
    queryCache: new QueryCache({
      onError: (err, query) => {
        if (query.state.data !== undefined) {
          // We already have data, this is a background refetch
          toastErr(err);
        }
      },
    }),
    defaultOptions: {
      queries: {
        throwOnError: (_err, query) => {
          // Throw if we don't already have data (indicating this isn't a
          // background refetch)
          return query.state.data === undefined;
        },
        retry: (_failureCount, err) => {
          // Fail fast for unauthorized errors so we can redirect to log in
          return !('code' in err && err.code === 401);
        },
        // With SSR, we usually want to set some default staleTime
        // above 0 to avoid refetching immediately on the client
        staleTime: 60 * 1000,
      },
      mutations: {
        onError: (err) => toastErr(err),
      },
    },
  });
}

let browserQueryClient: QueryClient | undefined = undefined;

function getQueryClient() {
  if (isServer || process.env.STORYBOOK) {
    // Server: always make a new query client
    return makeQueryClient();
  } else {
    // Browser: make a new query client if we don't already have one
    // This is very important, so we don't re-make a new client if React
    // suspends during the initial render. This may not be needed if we
    // have a suspense boundary BELOW the creation of the query client
    if (!browserQueryClient) browserQueryClient = makeQueryClient();
    return browserQueryClient;
  }
}

export default function Providers({
  children,
  forceDebugModeAllowed,
}: {
  children: ReactNode;
  forceDebugModeAllowed?: boolean;
}) {
  // NOTE: Avoid useState when initializing the query client if you don't
  //       have a suspense boundary between this and the code that may
  //       suspend because React will throw away the client on the initial
  //       render if it suspends and there is no boundary
  const queryClient = getQueryClient();

  return (
    <QueryClientProvider client={queryClient}>
      <ReactQueryDevtools initialIsOpen={false} />
      <DebugModeProvider forceAllowed={forceDebugModeAllowed}>
        <Toaster position="top-center" />
        {children}
      </DebugModeProvider>
    </QueryClientProvider>
  );
}

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TRPCClientError, createTRPCClient, httpBatchLink } from "@trpc/client";
import { Suspense, lazy, useEffect, useState } from "react";
import { BrowserRouter } from "react-router-dom";

import type { AppRouter } from "@pt/api";

import { AppRoutes } from "./routes.tsx";
import { TRPCProvider } from "./trpc.ts";

const ReactQueryDevtools = lazy(() =>
  import("@tanstack/react-query-devtools").then(m => ({
    default: m.ReactQueryDevtools,
  })),
);

export function Root() {
  const [devtoolsEnabled, setDevtoolsEnabled] = useState(false);

  useEffect(() => {
    console.log("Run enableDevtools() in the console to show query devtools");
    window.enableDevtools = () => setDevtoolsEnabled(true);
    return () => {
      delete window.enableDevtools;
    };
  }, []);

  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            throwOnError: true,
            retry: (failureCount, error) => {
              if (
                error instanceof TRPCClientError &&
                error.data?.code === "UNAUTHORIZED"
              ) {
                return false;
              }
              return failureCount < 3;
            },
          },
          mutations: { throwOnError: true },
        },
      }),
  );
  const [trpcClient] = useState(() =>
    createTRPCClient<AppRouter>({
      links: [httpBatchLink({ url: "/api/v1/trpc" })],
    }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <TRPCProvider
        trpcClient={trpcClient}
        queryClient={queryClient}
        keyPrefix="trpc">
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </TRPCProvider>
      {devtoolsEnabled && (
        <Suspense>
          <ReactQueryDevtools />
        </Suspense>
      )}
    </QueryClientProvider>
  );
}

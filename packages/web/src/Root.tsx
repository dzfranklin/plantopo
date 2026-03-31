import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createTRPCClient, httpBatchLink } from "@trpc/client";
import { Suspense, lazy, useEffect, useState } from "react";
import { BrowserRouter } from "react-router-dom";

import type { AppRouter } from "@pt/api";

import { isUnauthorizedError } from "./lib/errors.ts";
import { logger } from "./logger.ts";
import { AppRoutes } from "./routes.tsx";
import { TRPCProvider } from "./trpc.ts";

const ReactQueryDevtools = lazy(() =>
  import("@tanstack/react-query-devtools").then(m => ({
    default: m.ReactQueryDevtools,
  })),
);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      throwOnError: true,
      retry: (failureCount, err) => {
        if (isUnauthorizedError(err)) {
          logger.warn({ err }, "Unauthorized error, not retrying");
          return false;
        }

        return failureCount < 3;
      },
    },
    mutations: { throwOnError: true },
  },
});

const trpcClient = createTRPCClient<AppRouter>({
  links: [httpBatchLink({ url: "/api/v1/trpc" })],
});

export function Root() {
  const [devtoolsEnabled, setDevtoolsEnabled] = useState(false);

  useEffect(() => {
    console.log("Run enableDevtools() in the console to show query devtools");
    window.enableDevtools = () => setDevtoolsEnabled(true);
    return () => {
      delete window.enableDevtools;
    };
  }, []);

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

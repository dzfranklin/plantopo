import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createTRPCClient, httpBatchLink } from "@trpc/client";
import { BrowserRouter } from "react-router-dom";

import type { AppRouter } from "@pt/api";

import { LogViewerPanel } from "./components/LogViewerPanel.tsx";
import { QueryDevtoolsPanel } from "./components/QueryDevtoolsPanel.tsx";
import { Toaster } from "./components/ui/sonner.tsx";
import { isUnauthorizedError } from "./errors.ts";
import { useApiOfflineEffect } from "./hooks/useIsOnline.ts";
import { logger } from "./logger.ts";
import { AppRoutes } from "./routes.tsx";
import { TRPCProvider } from "./trpc.ts";

function Effects() {
  useApiOfflineEffect();
  return null;
}

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
  return (
    <QueryClientProvider client={queryClient}>
      <Effects />
      <Toaster />
      <TRPCProvider
        trpcClient={trpcClient}
        queryClient={queryClient}
        keyPrefix="trpc">
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </TRPCProvider>
      <QueryDevtoolsPanel />
      <LogViewerPanel />
    </QueryClientProvider>
  );
}

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createTRPCClient, httpBatchLink } from "@trpc/client";
import { Suspense, lazy, useState } from "react";
import { BrowserRouter } from "react-router-dom";

import type { AppRouter } from "@pt/api";

import { AppRoutes } from "./routes.tsx";
import { TRPCProvider } from "./trpc.ts";

const ReactQueryDevtools = import.meta.env.DEV
  ? lazy(() =>
      import("@tanstack/react-query-devtools").then((m) => ({
        default: m.ReactQueryDevtools,
      })),
    )
  : null;

export function Root() {
  const [queryClient] = useState(() => new QueryClient());
  const [trpcClient] = useState(() =>
    createTRPCClient<AppRouter>({
      links: [httpBatchLink({ url: "/api/v1/trpc" })],
    }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <TRPCProvider trpcClient={trpcClient} queryClient={queryClient}>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </TRPCProvider>
      {ReactQueryDevtools && (
        <Suspense>
          <ReactQueryDevtools />
        </Suspense>
      )}
    </QueryClientProvider>
  );
}

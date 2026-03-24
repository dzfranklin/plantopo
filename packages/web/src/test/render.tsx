import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import { createTRPCClient, httpBatchLink } from "@trpc/client";
import { type ReactNode, Suspense } from "react";

import type { AppRouter } from "@pt/api";

import { TRPCProvider } from "../trpc.ts";

export function renderWithProviders(ui: ReactNode) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const trpcClient = createTRPCClient<AppRouter>({
    links: [httpBatchLink({ url: `${process.env.TEST_API_URL}/api/v1/trpc` })],
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <TRPCProvider trpcClient={trpcClient} queryClient={queryClient}>
        <Suspense fallback={<div>Loading...</div>}>{ui}</Suspense>
      </TRPCProvider>
    </QueryClientProvider>,
  );
}

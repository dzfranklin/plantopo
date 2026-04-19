import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import { createTRPCClient, httpBatchLink } from "@trpc/client";
import { type ReactNode, Suspense } from "react";
import { MemoryRouter } from "react-router-dom";

import type { AppRouter } from "@pt/api";
import { TEST_SESSION } from "@pt/api/webTestSupport";

import { TRPCProvider } from "../trpc.ts";

export function renderWithProviders(
  ui: ReactNode,
  {
    initialPath = "/",
    session = TEST_SESSION,
  }: { initialPath?: string; session?: typeof TEST_SESSION | null } = {},
) {
  window.__INITIAL_USER__ = session ? session.user : null;

  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const trpcClient = createTRPCClient<AppRouter>({
    links: [
      httpBatchLink({
        url: `${process.env.TEST_API_URL}/api/v1/trpc`,
        headers: session ? { "x-test-session": JSON.stringify(session) } : {},
      }),
    ],
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <TRPCProvider
        trpcClient={trpcClient}
        queryClient={queryClient}
        keyPrefix="trpc">
        <MemoryRouter initialEntries={[initialPath]}>
          <Suspense fallback={<div>Loading...</div>}>{ui}</Suspense>
        </MemoryRouter>
      </TRPCProvider>
    </QueryClientProvider>,
  );
}

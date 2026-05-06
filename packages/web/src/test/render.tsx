import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createTRPCClient, httpLink } from "@trpc/client";
import { type ReactNode, Suspense } from "react";
import { MemoryRouter } from "react-router-dom";
import { render } from "vitest-browser-react";

import type { AppRouter } from "@pt/api";

import { TRPCProvider } from "../trpc.ts";
import type { User } from "@/auth/auth-client.ts";

export const TEST_USER = {
  id: "test",
  name: "Test User",
  email: "test@example.com",
  emailVerified: true,
  image: null,
  tileKey: "test-tile-key",
  eduAccess: false,
  createdAt: new Date("2024-01-01T00:00:00Z"),
  updatedAt: new Date("2024-01-01T00:00:00Z"),
  prefs: {},
} as const satisfies User;

const TRPC_BASE_URL = "http://localhost/api/v1/trpc";

export async function renderWithProviders(
  ui: ReactNode,
  {
    initialPath = "/",
    user = TEST_USER,
  }: {
    initialPath?: string;
    user?: User | null;
  } = {},
) {
  window.__INITIAL_USER__ = user ?? null;

  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  const trpcClient = createTRPCClient<AppRouter>({
    links: [
      httpLink({
        url: TRPC_BASE_URL,
        headers: user ? { "x-test-user": JSON.stringify(user) } : {},
      }),
    ],
  });

  function Providers({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <TRPCProvider
          trpcClient={trpcClient}
          queryClient={queryClient}
          keyPrefix="trpc">
          <MemoryRouter initialEntries={[initialPath]}>
            <Suspense fallback={<div>[Suspense fallback]</div>}>
              {children}
            </Suspense>
          </MemoryRouter>
        </TRPCProvider>
      </QueryClientProvider>
    );
  }

  return render(ui, { wrapper: Providers });
}

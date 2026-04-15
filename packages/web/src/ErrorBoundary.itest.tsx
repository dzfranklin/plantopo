import { useSuspenseQuery } from "@tanstack/react-query";
import { cleanup, screen, waitFor } from "@testing-library/react";
import { Suspense } from "react";
import { afterEach, describe, expect, it } from "vitest";

import { ErrorBoundary } from "./ErrorBoundary.tsx";
import { renderWithProviders } from "./test/render.tsx";
import { useTRPC } from "./trpc.ts";

afterEach(cleanup);

describe("reqId integration via testError endpoint", () => {
  it("shows a reqId returned from the server", async () => {
    function TestErrorThrower() {
      const trpc = useTRPC();
      useSuspenseQuery(trpc.test!.testError.queryOptions());
      return null;
    }

    // ErrorBoundary must be inside Suspense so errors from useSuspenseQuery reach it
    renderWithProviders(
      <Suspense>
        <ErrorBoundary>
          <TestErrorThrower />
        </ErrorBoundary>
      </Suspense>,
    );

    await waitFor(() => {
      expect(screen.getByText(/^ref: 1/)).toBeInTheDocument();
    });
  });
});

import { useSuspenseQuery } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { TRPCClientError } from "@trpc/client";
import { Suspense } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { AppRouter } from "@pt/api";

import { ErrorBoundary } from "./ErrorBoundary.tsx";
import { renderWithProviders } from "./test/render.tsx";
import { useTRPC } from "./trpc.ts";

afterEach(cleanup);

// Suppress React's error boundary console.error noise in tests
beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
});

function makeTRPCError(
  code: string,
  extra?: Record<string, unknown>,
): TRPCClientError<AppRouter> {
  return new TRPCClientError("test", {
    result: {
      error: {
        message: "test",
        code: -32600,
        data: {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          code: code as any,
          httpStatus: 500,
          path: "test",
          ...extra,
        },
      },
    },
  });
}

function ThrowOnMount({ error }: { error: unknown }): never {
  throw error;
}

describe("ErrorBoundary", () => {
  describe("UNAUTHORIZED", () => {
    it("redirects to /login with returnTo", () => {
      const assignSpy = vi.fn();
      const loc = { ...window.location, pathname: "/some-page", search: "" };
      Object.defineProperty(loc, "href", { set: assignSpy });
      vi.spyOn(window, "location", "get").mockReturnValue(loc as Location);

      render(
        <ErrorBoundary>
          <ThrowOnMount error={makeTRPCError("UNAUTHORIZED")} />
        </ErrorBoundary>,
      );

      expect(assignSpy).toHaveBeenCalledWith(
        expect.stringContaining("/login?returnTo="),
      );
    });

    it("does not show error UI", () => {
      render(
        <ErrorBoundary>
          <ThrowOnMount error={makeTRPCError("UNAUTHORIZED")} />
        </ErrorBoundary>,
      );
      expect(
        screen.queryByText(/Something went wrong/),
      ).not.toBeInTheDocument();
    });
  });

  describe("FORBIDDEN", () => {
    it("shows custom message", () => {
      render(
        <ErrorBoundary>
          <ThrowOnMount error={makeTRPCError("FORBIDDEN")} />
        </ErrorBoundary>,
      );
      expect(screen.getByText(/Permission denied/)).toBeInTheDocument();
    });
  });

  describe("NOT_FOUND", () => {
    it("shows custom message", () => {
      render(
        <ErrorBoundary>
          <ThrowOnMount error={makeTRPCError("NOT_FOUND")} />
        </ErrorBoundary>,
      );
      expect(screen.getByText(/Not found/)).toBeInTheDocument();
    });
  });

  describe("TOO_MANY_REQUESTS", () => {
    it("shows custom message", () => {
      render(
        <ErrorBoundary>
          <ThrowOnMount error={makeTRPCError("TOO_MANY_REQUESTS")} />
        </ErrorBoundary>,
      );
      expect(screen.getByText(/Too many requests/)).toBeInTheDocument();
    });
  });

  describe("INTERNAL_SERVER_ERROR", () => {
    it("shows generic message", () => {
      render(
        <ErrorBoundary>
          <ThrowOnMount error={makeTRPCError("INTERNAL_SERVER_ERROR")} />
        </ErrorBoundary>,
      );
      expect(screen.getByText(/Something went wrong/)).toBeInTheDocument();
    });

    it("shows reqId when present", () => {
      render(
        <ErrorBoundary>
          <ThrowOnMount
            error={makeTRPCError("INTERNAL_SERVER_ERROR", { reqId: "abc-123" })}
          />
        </ErrorBoundary>,
      );
      expect(screen.getByText("ref: abc-123")).toBeInTheDocument();
    });

    it("omits reqId section when absent", () => {
      render(
        <ErrorBoundary>
          <ThrowOnMount error={makeTRPCError("INTERNAL_SERVER_ERROR")} />
        </ErrorBoundary>,
      );
      expect(screen.queryByText(/ref:/)).not.toBeInTheDocument();
    });
  });

  describe("non-TRPC error", () => {
    it("shows error message", () => {
      render(
        <ErrorBoundary>
          <ThrowOnMount error={new Error("it go boom")} />
        </ErrorBoundary>,
      );
      expect(screen.getByText("Error: it go boom")).toBeInTheDocument();
    });

    it("omits reqId section", () => {
      render(
        <ErrorBoundary>
          <ThrowOnMount error={new Error("it go boom")} />
        </ErrorBoundary>,
      );
      expect(screen.queryByText(/ref:/)).not.toBeInTheDocument();
    });
  });

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
});

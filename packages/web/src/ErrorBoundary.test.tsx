import { TRPCClientError } from "@trpc/client";
import { describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";

import type { AppRouter } from "@pt/api";

import { ErrorBoundary } from "./ErrorBoundary.tsx";

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
          code: code as any,
          httpStatus: 500,
          path: "test",
          clientError: undefined,
          reqId: "request-id",
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
  it("UNAUTHORIZED redirects to /login with returnTo", async () => {
    const navigateSpy = vi.fn();

    await render(
      <ErrorBoundary forTesting={{ navigate: navigateSpy }}>
        <ThrowOnMount error={makeTRPCError("UNAUTHORIZED")} />
      </ErrorBoundary>,
    );

    expect(navigateSpy).toHaveBeenCalledWith(
      expect.stringContaining("/login?returnTo="),
    );
  });

  describe("FORBIDDEN", () => {
    it("shows custom message", async () => {
      const screen = await render(
        <ErrorBoundary>
          <ThrowOnMount error={makeTRPCError("FORBIDDEN")} />
        </ErrorBoundary>,
      );
      await expect
        .element(screen.getByText(/Permission denied/))
        .toBeInTheDocument();
    });
  });

  describe("NOT_FOUND", () => {
    it("shows custom message", async () => {
      const screen = await render(
        <ErrorBoundary>
          <ThrowOnMount error={makeTRPCError("NOT_FOUND")} />
        </ErrorBoundary>,
      );
      await expect.element(screen.getByText(/Not found/)).toBeInTheDocument();
    });
  });

  describe("TOO_MANY_REQUESTS", () => {
    it("shows custom message", async () => {
      const screen = await render(
        <ErrorBoundary>
          <ThrowOnMount error={makeTRPCError("TOO_MANY_REQUESTS")} />
        </ErrorBoundary>,
      );
      await expect
        .element(screen.getByText(/Too many requests/))
        .toBeInTheDocument();
    });
  });

  describe("INTERNAL_SERVER_ERROR", () => {
    it("shows generic message", async () => {
      const screen = await render(
        <ErrorBoundary>
          <ThrowOnMount error={makeTRPCError("INTERNAL_SERVER_ERROR")} />
        </ErrorBoundary>,
      );
      await expect
        .element(screen.getByText(/Something went wrong/))
        .toBeInTheDocument();
    });

    it("shows reqId when present", async () => {
      const screen = await render(
        <ErrorBoundary>
          <ThrowOnMount
            error={makeTRPCError("INTERNAL_SERVER_ERROR", { reqId: "abc-123" })}
          />
        </ErrorBoundary>,
      );
      await expect.element(screen.getByText("abc-123")).toBeInTheDocument();
    });

    it("omits reqId section when absent", async () => {
      const screen = await render(
        <ErrorBoundary>
          <ThrowOnMount error={makeTRPCError("INTERNAL_SERVER_ERROR")} />
        </ErrorBoundary>,
      );
      await expect.element(screen.getByText(/ref:/)).not.toBeInTheDocument();
    });
  });

  describe("non-TRPC error", () => {
    it("shows error message", async () => {
      const screen = await render(
        <ErrorBoundary>
          <ThrowOnMount error={new Error("it go boom")} />
        </ErrorBoundary>,
      );
      await expect
        .element(screen.getByText("Error: it go boom").first())
        .toBeInTheDocument();
    });

    it("omits reqId section", async () => {
      const screen = await render(
        <ErrorBoundary>
          <ThrowOnMount error={new Error("it go boom")} />
        </ErrorBoundary>,
      );
      await expect.element(screen.getByText(/ref:/)).not.toBeInTheDocument();
    });
  });
});

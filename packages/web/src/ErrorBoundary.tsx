import { TRPCClientError } from "@trpc/client";
import { Component, type ReactNode } from "react";

import type { AppRouter } from "@pt/api";

import { logger } from "./logger.js";

interface Props {
  children: ReactNode;
}

interface State {
  error: unknown;
}

function trpcMessage(error: TRPCClientError<AppRouter>): string | null {
  switch (error.data?.code) {
    case "FORBIDDEN":
      return "Permission denied";
    case "NOT_FOUND":
      return "Not found";
    case "TOO_MANY_REQUESTS":
      return "Too many requests, slow down";
    default:
      return null;
  }
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: unknown): State {
    return { error };
  }

  componentDidCatch(error: unknown, info: React.ErrorInfo) {
    logger.error(
      { error, componentStack: info.componentStack },
      "React error boundary caught",
    );
  }

  render() {
    if (this.state.error) {
      if (
        this.state.error instanceof TRPCClientError &&
        this.state.error.data?.code === "UNAUTHORIZED"
      ) {
        const returnTo = encodeURIComponent(
          window.location.pathname + window.location.search,
        );
        window.location.href = `/login?returnTo=${returnTo}`;
        return null;
      }

      const reqId =
        this.state.error instanceof TRPCClientError
          ? (this.state.error.data?.reqId as string | undefined)
          : undefined;

      const customMessage =
        this.state.error instanceof TRPCClientError
          ? trpcMessage(this.state.error)
          : null;

      const errorMessage =
        this.state.error instanceof Error ? this.state.error.message : null;

      return (
        <div className="flex min-h-screen items-center justify-center bg-gray-50">
          <div className="max-w-md rounded-lg border border-red-200 bg-white p-8 text-center shadow-sm">
            <div className="mb-4 text-4xl">⚠️</div>
            <h1 className="mb-2 text-xl font-semibold text-gray-900">
              {customMessage ??
                "Something went wrong. Please try refreshing the page."}
            </h1>
            <p className="text-sm text-gray-500">{errorMessage}</p>
            {reqId && (
              <p className="mt-4 rounded bg-gray-100 px-3 py-2 font-mono text-xs text-gray-400">
                ref: {reqId}
              </p>
            )}
            <button
              onClick={() => window.location.reload()}
              className="mt-6 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              Refresh page
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

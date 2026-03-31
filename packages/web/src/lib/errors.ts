import { TRPCClientError } from "@trpc/client";

export function isUnauthorizedError(err: unknown): boolean {
  return (
    (err instanceof TRPCClientError && err.data?.code === "UNAUTHORIZED") ||
    // better-auth format
    (typeof err === "object" &&
      err !== null &&
      "status" in err &&
      err.status === 401)
  );
}

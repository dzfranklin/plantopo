import { createTRPCContext } from "@trpc/tanstack-react-query";

import type { AppRouter } from "@pt/api";

type TRPCContext = ReturnType<
  typeof createTRPCContext<AppRouter, { keyPrefix: true }>
>;

const ctx = createTRPCContext<AppRouter, { keyPrefix: true }>();

export const TRPCProvider: TRPCContext["TRPCProvider"] = ctx.TRPCProvider;
export const useTRPC: TRPCContext["useTRPC"] = ctx.useTRPC;
export const useTRPCClient: TRPCContext["useTRPCClient"] = ctx.useTRPCClient;

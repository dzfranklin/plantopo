import { TRPCError } from "@trpc/server";

import { counterRouter } from "./counter/counter.router.js";
import { publicProcedure, router } from "./trpc.js";

const testRouter = router({
  testError: publicProcedure.query(() => {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "test error",
    });
  }),
});

export const appRouter = router({
  ping: publicProcedure.query(() => "pong"),
  counter: counterRouter,
  ...(process.env.NODE_ENV === "test" ? { test: testRouter } : {}),
});

export type AppRouter = typeof appRouter;

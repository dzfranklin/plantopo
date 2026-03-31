import { TRPCError } from "@trpc/server";

import { stravaRouter } from "./strava/strava.router.js";
import { trackRouter } from "./track/track.router.js";
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
  track: trackRouter,
  strava: stravaRouter,
  ...(process.env.NODE_ENV === "test" ? { test: testRouter } : {}),
});

export type AppRouter = typeof appRouter;

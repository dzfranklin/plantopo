import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { authedProcedure, router } from "../trpc.js";
import { getLoggedInAthleteActivities } from "./strava.api.js";
import { deleteStravaConnection, getStravaAccount } from "./strava.service.js";

export const stravaRouter = router({
  account: authedProcedure.query(async ({ ctx }) => {
    return getStravaAccount(ctx.user.id);
  }),

  disconnect: authedProcedure.mutation(async ({ ctx }) => {
    const deleted = await deleteStravaConnection(ctx.user.id);
    if (!deleted) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "No Strava account linked",
      });
    }
  }),

  listActivities: authedProcedure
    .input(
      z.object({
        page: z.number().int().min(1).default(1),
        per_page: z.number().int().min(1).max(100).default(30),
        before: z.number().int().optional(),
        after: z.number().int().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      return getLoggedInAthleteActivities(ctx.user.id, input);
    }),
});

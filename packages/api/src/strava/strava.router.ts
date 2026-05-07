import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { authedProcedure, router } from "../trpc.js";
import { importStravaActivity } from "./import.js";
import { ActivityListPageSchema, stravaApi } from "./strava.api.js";
import {
  StravaAccountSchema,
  deleteStravaConnection,
  getStravaAccount,
} from "./strava.service.js";

export const stravaRouter = router({
  account: authedProcedure
    .input(z.void())
    .output(StravaAccountSchema.nullable())
    .query(async ({ ctx }) => {
      return getStravaAccount(ctx.user.id);
    }),

  disconnect: authedProcedure
    .input(z.void())
    .output(z.void())
    .mutation(async ({ ctx }) => {
      const deleted = await deleteStravaConnection(ctx.user.id);
      if (!deleted) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "No Strava account linked",
        });
      }
    }),

  listActivities: authedProcedure
    .input(z.object({ cursor: z.string().optional() }))
    .output(ActivityListPageSchema)
    .query(async ({ ctx, input }) => {
      return stravaApi.listActivitiesPage(ctx.user.id, input.cursor);
    }),

  importActivities: authedProcedure
    .input(z.object({ activityIds: z.array(z.number()) }))
    .output(z.void())
    .mutation(async ({ ctx, input }) => {
      await Promise.all(
        input.activityIds.map(activityId =>
          importStravaActivity({ userId: ctx.user.id, activityId }),
        ),
      );
    }),
});

import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { authedProcedure, router } from "../trpc.js";
import { ListActivitiesInputSchema, stravaApi } from "./strava.api.js";
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
    .input(ListActivitiesInputSchema.optional())
    .mutation(async ({ ctx, input }) => {
      return stravaApi.listActivities(ctx.user.id, input ?? {});
    }),

  getActivity: authedProcedure
    .input(
      z.object({
        activityId: z.number().int(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return stravaApi.getActivity(ctx.user.id, input.activityId);
    }),
});

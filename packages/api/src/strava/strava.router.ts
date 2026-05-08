import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { type ImportStatus, getImportStatuses } from "../track/imports.js";
import { authedProcedure, router } from "../trpc.js";
import { importStravaActivity } from "./import.js";
import {
  ActivityListPageSchema,
  SummaryActivitySchema,
  stravaApi,
} from "./strava.api.js";
import {
  StravaAccountSchema,
  deleteStravaConnection,
  getStravaAccount,
} from "./strava.service.js";

const ImportStatusSchema = z.enum(["none", "pending", "done", "track_deleted"]);

const ActivityWithStatusSchema = SummaryActivitySchema.and(
  z.object({ importStatus: ImportStatusSchema }),
);

export type ActivityWithStatus = z.infer<typeof ActivityWithStatusSchema>;

const ActivityListPageWithStatusSchema = z.object({
  activities: z.array(ActivityWithStatusSchema),
  nextCursor: ActivityListPageSchema.shape.nextCursor,
});

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
    .output(ActivityListPageWithStatusSchema)
    .query(async ({ ctx, input }) => {
      const page = await stravaApi.listActivitiesPage(
        ctx.user.id,
        input.cursor,
      );
      const sourceIds = page.activities.map(a => a.id.toString());
      const statuses = await getImportStatuses(
        ctx.user.id,
        "strava",
        sourceIds,
      );
      return {
        ...page,
        activities: page.activities.map(a => ({
          ...a,
          importStatus: (statuses.get(a.id.toString()) ??
            "none") satisfies ImportStatus,
        })),
      };
    }),

  importActivities: authedProcedure
    .input(
      z.object({
        activityIds: z.array(z.number()),
        forceRefetch: z.boolean().optional(),
      }),
    )
    .output(z.void())
    .mutation(async ({ ctx, input }) => {
      await Promise.all(
        input.activityIds.map(activityId =>
          importStravaActivity({
            userId: ctx.user.id,
            activityId,
            force: input.forceRefetch,
          }),
        ),
      );
    }),
});

import z from "zod";

import { LocalRecordedTrackSchema } from "@pt/shared";

import { getLog } from "../logger.js";
import { authedProcedure, router } from "../trpc.js";
import {
  getRecordedTrack,
  getRecordedTrackWithPointDetail,
  listRecordedTracks,
  uploadedRecordedTrack,
} from "./track.service.js";

export const trackRouter = router({
  uploadRecordedTrack: authedProcedure
    .input(
      LocalRecordedTrackSchema.omit({ status: true }).extend({
        endTime: z.number(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      getLog().info({ input: JSON.stringify(input) }, "TODO: record");
      await uploadedRecordedTrack(ctx.session.user.id, input);
    }),

  listRecordedTracks: authedProcedure.query(async ({ ctx }) => {
    return listRecordedTracks(ctx.session.user.id);
  }),

  getRecordedTrack: authedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input, ctx }) => {
      return getRecordedTrack(ctx.session.user.id, input.id);
    }),

  getRecordedTrackWithPointDetail: authedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input, ctx }) => {
      return getRecordedTrackWithPointDetail(ctx.session.user.id, input.id);
    }),
});

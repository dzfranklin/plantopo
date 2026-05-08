import z from "zod";

import { LocalRecordedTrackSchema } from "@pt/shared";

import { authedProcedure, router } from "../trpc.js";
import {
  getTrack,
  getTrackWithPointDetail,
  listTracks,
  updateTrack,
  uploadTrack,
} from "./track.service.js";

export const trackRouter = router({
  updateTrack: authedProcedure
    .input(z.object({ id: z.string(), name: z.string().nullable() }))
    .mutation(async ({ input, ctx }) => {
      await updateTrack(ctx.user.id, input.id, { name: input.name });
    }),

  uploadTrack: authedProcedure
    .input(
      LocalRecordedTrackSchema.omit({ status: true }).extend({
        endTime: z.number(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      await uploadTrack(ctx.user.id, input);
    }),

  listTracks: authedProcedure.query(async ({ ctx }) => {
    return listTracks(ctx.user.id);
  }),

  getTrack: authedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input, ctx }) => {
      return getTrack(ctx.user.id, input.id);
    }),

  getTrackWithPointDetail: authedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input, ctx }) => {
      return getTrackWithPointDetail(ctx.user.id, input.id);
    }),
});

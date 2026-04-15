import z from "zod";

import { LocalRecordedTrackSchema } from "@pt/shared";

import { authedProcedure, router } from "../trpc.js";
import {
  getRecordedTrack,
  getRecordedTrackWithPointDetail,
  listRecordedTracks,
  uploadedRecordedTrack,
} from "./track.service.js";

export const trackRouter = router({
  uploadRecordedTrack: authedProcedure
    .input(LocalRecordedTrackSchema)
    .mutation(async ({ input, ctx }) => {
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

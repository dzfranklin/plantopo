import { RecordedTrackSchema } from "@pt/shared";

import { authedProcedure, router } from "../trpc.js";
import { uploadedRecordedTrack } from "./track.service.js";

export const trackRouter = router({
  uploadRecordedTrack: authedProcedure
    .input(RecordedTrackSchema)
    .mutation(async ({ input }) => {
      await uploadedRecordedTrack(input);
    }),
});

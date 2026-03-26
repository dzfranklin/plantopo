import { z } from "zod";

import { RecordedTrackSchema } from "@pt/shared";

export const RecordTrackStateSchema = z.object({
  recording: RecordedTrackSchema.nullable(),
});

export type RecordTrackState = z.infer<typeof RecordTrackStateSchema>;

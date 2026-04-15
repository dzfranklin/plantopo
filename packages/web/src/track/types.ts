import { z } from "zod";

import { LocalRecordedTrackSchema } from "@pt/shared";

export const RecordTrackStateSchema = z.object({
  recording: LocalRecordedTrackSchema.nullable(),
});

export type RecordTrackState = z.infer<typeof RecordTrackStateSchema>;

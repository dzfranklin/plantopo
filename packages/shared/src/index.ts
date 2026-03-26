import z from "zod";

const RecordingStatusSchema = z.enum([
  "RECORDING",
  "STOPPED",
  "SYNCED",
  "SYNC_FAILED",
]);

const TrackPointSchema = z.object({
  timestamp: z.number(),
  latitude: z.number(),
  longitude: z.number(),
  elevation: z.number().nullable(),
  horizontalAccuracy: z.number().nullable(),
  verticalAccuracy: z.number().nullable(),
  speed: z.number().nullable(),
  speedAccuracy: z.number().nullable(),
  bearing: z.number().nullable(),
  bearingAccuracy: z.number().nullable(),
});

export const RecordedTrackSchema = z.object({
  id: z.uuidv4(),
  name: z.string().nullable(),
  startTime: z.number(),
  endTime: z.number().nullable(),
  status: RecordingStatusSchema,
  points: z.array(TrackPointSchema),
});

export type RecordedTrackStatus = z.infer<typeof RecordingStatusSchema>;
export type RecordedTrackPoint = z.infer<typeof TrackPointSchema>;
export type RecordedTrack = z.infer<typeof RecordedTrackSchema>;

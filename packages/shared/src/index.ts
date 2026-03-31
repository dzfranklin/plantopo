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

const sourceURLSchema = z.string().startsWith("https://");
const boundsSchema = z.tuple([z.number(), z.number(), z.number(), z.number()]);

export const CustomBaseStyleSchema = z.object({
  type: z.literal("raster"),
  url: sourceURLSchema.optional(),
  tiles: z.array(sourceURLSchema).nonempty().optional(),
  bounds: boundsSchema.optional(),
  minzoom: z.number().optional(),
  maxzoom: z.number().optional(),
  tileSize: z.number().optional(),
  scheme: z.enum(["xyz", "tms"]).optional(),
  attribution: z.string().optional(),
});

export const UserPrefsSchema = z.object({
  distanceUnit: z.enum(["km", "mi"]).default("km"),
  customBaseStylesByName: z
    .record(z.string(), CustomBaseStyleSchema)
    .default({}),
});

export type UserPrefs = z.infer<typeof UserPrefsSchema>;

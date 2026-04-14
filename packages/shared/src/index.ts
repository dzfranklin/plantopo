import z from "zod";

export * from "./style.js";
export * from "./polyline.js";

export const METERS_TO_FT = 3.28084;

export const PointSchema = z.tuple([z.number(), z.number()]);

export type Point = [number, number];
export type Point3 = [number, number, number | null];

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

export const UserPrefsSchema = z.object({
  distanceUnit: z.enum(["km", "mi"]).default("km"),
});

export type UserPrefs = z.infer<typeof UserPrefsSchema>;

/** by is a sort helper. Usage: array.sort(by('key1', 'key2')) */
export function by(...keys: string[]) {
  return (a: Record<string, unknown>, b: Record<string, unknown>) => {
    let va;
    let vb;
    for (const key of keys) {
      va = a[key];
      if (va === undefined) continue;
      break;
    }
    for (const key of keys) {
      vb = b[key];
      if (vb === undefined) continue;
      break;
    }
    if ((va === undefined || va === null) && (vb === undefined || vb === null))
      return 0;
    if (va === undefined || va === null) return 1;
    if (vb === undefined || vb === null) return -1;
    if (va < vb) return -1;
    if (va > vb) return 1;
    return 0;
  };
}

export function round(n: number, precision: number): number {
  const factor = Math.pow(10, precision);
  return Math.round(n * factor) / factor;
}

export function round2(
  v: [number, number],
  precision: number,
): [number, number] {
  return [round(v[0], precision), round(v[1], precision)];
}

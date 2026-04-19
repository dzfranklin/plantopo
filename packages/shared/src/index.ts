import z from "zod";

export * from "./style.js";
export * from "./polyline.js";

export const METERS_TO_FT = 3.28084;

export const PointSchema = z.tuple([z.number(), z.number()]);

export type Point = [number, number];
export type Point3 = [number, number, number | null];

const LocalRecordingStatusSchema = z.enum([
  "RECORDING",
  "STOPPED",
  "SYNCED",
  "SYNC_FAILED",
]);

const LocalTrackPointSchema = z.object({
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

export const LocalRecordedTrackSchema = z.object({
  id: z.uuidv4(),
  name: z.string().nullable(),
  startTime: z.number(),
  endTime: z.number().nullable(),
  status: LocalRecordingStatusSchema,
  points: z.array(LocalTrackPointSchema),
});

export type LocalRecordedTrackStatus = z.infer<
  typeof LocalRecordingStatusSchema
>;
export type LocalRecordedTrackPoint = z.infer<typeof LocalTrackPointSchema>;
export type LocalRecordedTrack = z.infer<typeof LocalRecordedTrackSchema>;

export const UserPrefsSchema = z.object({
  distanceUnit: z.enum(["km", "mi"]).default("km"),
});

export type UserPrefs = z.infer<typeof UserPrefsSchema>;

interface ByOptions {
  locale?: boolean;
  numeric?: boolean;
}

/**
 * by is a sort helper. Usage: array.sort(by('key1', 'key2')) or array.sort(by(['key1', 'key2'], { numeric: true }))
 * If the primary keys compare equal, remaining keys from both objects are compared in alphabetical order for a stable sort.
 */
export function by(keys: string | string[], options: ByOptions = {}) {
  const keyList = Array.isArray(keys) ? keys : [keys];
  const keySet = new Set(keyList);
  return (a: Record<string, unknown>, b: Record<string, unknown>) => {
    let va;
    let vb;
    for (const key of keyList) {
      va = a[key];
      if (va === undefined) continue;
      break;
    }
    for (const key of keyList) {
      vb = b[key];
      if (vb === undefined) continue;
      break;
    }
    const primary = compareValues(va, vb, options);
    if (primary !== 0) return primary;
    const fallbackKeys = [...new Set([...Object.keys(a), ...Object.keys(b)])]
      .filter(k => !keySet.has(k))
      .sort();
    for (const key of fallbackKeys) {
      const result = compareValues(a[key], b[key], options);
      if (result !== 0) return result;
    }
    return 0;
  };
}

export function by0(options: ByOptions = {}) {
  return byN(0, options);
}

export function by1(options: ByOptions = {}) {
  return byN(1, options);
}

function byN(n: number, options: ByOptions = {}) {
  return (a: unknown[], b: unknown[]) => compareValues(a[n], b[n], options);
}

function compareValues(va: unknown, vb: unknown, options: ByOptions): number {
  if ((va === undefined || va === null) && (vb === undefined || vb === null))
    return 0;
  if (va === undefined || va === null) return 1;
  if (vb === undefined || vb === null) return -1;
  if (
    typeof va === "string" &&
    typeof vb === "string" &&
    (options.locale || options.numeric !== undefined)
  ) {
    return va.localeCompare(vb, undefined, {
      numeric: options.numeric,
    });
  }
  if (va < vb) return -1;
  if (va > vb) return 1;
  return 0;
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

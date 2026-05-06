import z from "zod";

export * from "./style.js";
export * from "./polyline.js";
export * from "./hash.js";

export const METERS_TO_FT = 3.28084;

export const PointSchema = z.tuple([z.number(), z.number()]);

export type Point2 = [number, number];
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

type Comparator<T extends object> = (a: T, b: T) => number;
type ByKeys<T extends object> = keyof T | (keyof T)[];
type ByGetter<T extends object> = (obj: T) => unknown;

/**
 * by is a sort helper. Usage: array.sort(by('key1', 'key2')) or array.sort(by(['key1', 'key2'], { numeric: true }))
 * If the primary keys compare equal, remaining keys from both objects are compared in alphabetical order for a stable sort.
 */
export function by<T extends object>(
  keys: ByKeys<T>,
  opts?: ByOptions,
): Comparator<T>;
export function by<T extends object>(
  fn: ByGetter<T>,
  opts?: ByOptions,
): Comparator<T>;

export function by<T extends object>(
  arg1: ByKeys<T> | ByGetter<T>,
  opts: ByOptions = {},
): Comparator<T> {
  if (typeof arg1 === "function") return byGetter(arg1, opts);
  else return byKeys(arg1, opts);
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

function byKeys<T extends object>(
  keys: ByKeys<T>,
  opts: ByOptions = {},
): Comparator<T> {
  return (a, b) => {
    for (const key of Array.isArray(keys) ? keys : [keys]) {
      const aHas = key in a;
      const bHas = key in b;
      if (!aHas && !bHas) continue;
      else if (!aHas) return -1;
      else if (!bHas) return 1;

      const cmp = compareValues(a[key], b[key], opts);
      if (cmp !== 0) return cmp;
    }
    return compareValues(a, b);
  };
}

function byGetter<T extends object>(
  getter: (obj: T) => unknown,
  opts: ByOptions = {},
): Comparator<T> {
  return (a, b) => {
    const va = getter(a);
    const vb = getter(b);
    return compareValues(va, vb, opts) || compareValues(a, b);
  };
}

function compareValues(va: unknown, vb: unknown, opts: ByOptions = {}): number {
  if (va === vb) return 0;

  // sort strings with localeCompare if either locale or numeric option is specified
  if (
    typeof va === "string" &&
    typeof vb === "string" &&
    (opts.locale || opts.numeric !== undefined)
  ) {
    return va.localeCompare(vb, undefined, {
      numeric: opts.numeric,
    });
  }

  // to match default sort behavior, convert to strings
  const sa = String(va);
  const sb = String(vb);
  return sa < sb ? -1 : 1;
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

export function add2(
  a: [number, number],
  b: [number, number],
): [number, number] {
  return [a[0] + b[0], a[1] + b[1]];
}

export function mul2(v: [number, number], factor: number): [number, number] {
  return [v[0] * factor, v[1] * factor];
}

export function sub2(
  a: [number, number],
  b: [number, number],
): [number, number] {
  return [a[0] - b[0], a[1] - b[1]];
}

export function div2(v: [number, number], factor: number): [number, number] {
  return [v[0] / factor, v[1] / factor];
}

export const ClientLogEntrySchema = z.object({
  level: z.enum(["trace", "debug", "info", "warn", "error", "fatal"]),
  msg: z.string(),
  ts: z.number(),
  extra: z.record(z.string(), z.unknown()).optional(),
});

export type ClientLogEntry = z.infer<typeof ClientLogEntrySchema>;

export const ClientLogsPostBodySchema = z.object({
  entries: z.array(ClientLogEntrySchema),
});

export type ClientLogsPostBody = z.infer<typeof ClientLogsPostBodySchema>;

export function createSeededRandom(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

import { and, eq, sql } from "drizzle-orm";
import z from "zod";

import { type LocalRecordedTrack } from "@pt/shared";

import { db } from "../db.js";
import { getLog } from "../logger.js";
import { recordedTrack } from "./track.schema.js";

export const RecordedTrackSummarySchema = z.object({
  id: z.string(),
  name: z.string().nullable(),
  startTime: z.number(), // epoch ms
  endTime: z.number().nullable(), // epoch ms
  createdAt: z.number(), // epoch ms
  distanceM: z.number().nullable(), // null if no path
  durationMs: z.number().nullable(), // null if no endTime
  summaryPolyline: z.string(), // simplified ~100m tolerance, for thumbnail display
});

export type RecordedTrackSummary = z.infer<typeof RecordedTrackSummarySchema>;

export const RecordedTrackSchema = RecordedTrackSummarySchema.extend({
  polyline: z.string(), // full resolution, for map/detail view
  pointTimestamps: z.array(z.number()),
  pointSpeed: z.array(z.number().nullable()).nullable(),
  pointSpeedAccuracy: z.array(z.number().nullable()).nullable(),
});

export type RecordedTrack = z.infer<typeof RecordedTrackSchema>;

export const RecordedTrackWithPointDetailSchema = RecordedTrackSchema.extend({
  pointGpsElevation: z.array(z.number().nullable()).nullable(),
  pointHorizontalAccuracy: z.array(z.number().nullable()).nullable(),
  pointVerticalAccuracy: z.array(z.number().nullable()).nullable(),
  pointBearing: z.array(z.number().nullable()).nullable(),
  pointBearingAccuracy: z.array(z.number().nullable()).nullable(),
});

export type RecordedTrackWithPointDetail = z.infer<
  typeof RecordedTrackWithPointDetailSchema
>;

export async function uploadedRecordedTrack(
  userId: string,
  payload: Omit<LocalRecordedTrack, "status"> & { endTime: number },
) {
  const log = getLog().child({ userId, trackId: payload.id });
  const pts = payload.points;

  if (pts.length < 2) {
    log.warn({ payload }, "Track has fewer than 2 points, rejecting");
    return;
  }

  const path = JSON.stringify({
    type: "LineString",
    coordinates: pts.map(p => [p.longitude, p.latitude]),
  });

  const nullableArray = <T>(arr: (T | null)[]): T[] | null =>
    arr.some(v => v === null) ? null : (arr as T[]);

  await db
    .insert(recordedTrack)
    .values({
      id: payload.id,
      userId,
      name: payload.name ?? null,
      startTime: new Date(payload.startTime),
      endTime: new Date(payload.endTime),
      path: sql`ST_GeomFromGeoJSON(${path})`,
      pointTimestamps: pts.map(p => p.timestamp),
      pointGpsElevation: nullableArray(pts.map(p => p.elevation)),
      pointHorizontalAccuracy: nullableArray(
        pts.map(p => p.horizontalAccuracy),
      ),
      pointVerticalAccuracy: nullableArray(pts.map(p => p.verticalAccuracy)),
      pointSpeed: nullableArray(pts.map(p => p.speed)),
      pointSpeedAccuracy: nullableArray(pts.map(p => p.speedAccuracy)),
      pointBearing: nullableArray(pts.map(p => p.bearing)),
      pointBearingAccuracy: nullableArray(pts.map(p => p.bearingAccuracy)),
    })
    .onConflictDoNothing();

  log.info("uploadedRecordedTrack");
}

const summaryColumns = {
  id: recordedTrack.id,
  name: recordedTrack.name,
  startTime: recordedTrack.startTime,
  endTime: recordedTrack.endTime,
  createdAt: recordedTrack.createdAt,
  distanceM: sql<number | null>`ST_Length(${recordedTrack.path}::geography)`.as(
    "distance_m",
  ),
  durationMs: sql<
    number | null
  >`(EXTRACT(EPOCH FROM (${recordedTrack.endTime} - ${recordedTrack.startTime})) * 1000)::float8`.as(
    "duration_ms",
  ),
  summaryPolyline: sql<
    string | null
  >`ST_AsEncodedPolyline(ST_Simplify(${recordedTrack.path}, 0.001))`.as(
    "summary_polyline",
  ),
};

export async function listRecordedTracks(
  userId: string,
): Promise<RecordedTrackSummary[]> {
  const rows = await db
    .select(summaryColumns)
    .from(recordedTrack)
    .where(eq(recordedTrack.userId, userId))
    .orderBy(sql`${recordedTrack.startTime} DESC`);

  return rows.map(toSummary);
}

export async function getRecordedTrack(
  userId: string,
  trackId: string,
): Promise<RecordedTrack | null> {
  const [row] = await db
    .select({
      ...summaryColumns,
      polyline: sql<
        string | null
      >`ST_AsEncodedPolyline(${recordedTrack.path})`.as("polyline"),
      pointTimestamps: recordedTrack.pointTimestamps,
      pointSpeed: recordedTrack.pointSpeed,
      pointSpeedAccuracy: recordedTrack.pointSpeedAccuracy,
    })
    .from(recordedTrack)
    .where(
      and(eq(recordedTrack.id, trackId), eq(recordedTrack.userId, userId)),
    );

  if (!row) return null;

  return {
    ...toSummary(row),
    polyline: row.polyline!,
    pointTimestamps: row.pointTimestamps,
    pointSpeed: row.pointSpeed,
    pointSpeedAccuracy: row.pointSpeedAccuracy,
  };
}

export async function getRecordedTrackWithPointDetail(
  userId: string,
  trackId: string,
): Promise<RecordedTrackWithPointDetail | null> {
  const [row] = await db
    .select({
      ...summaryColumns,
      polyline: sql<
        string | null
      >`ST_AsEncodedPolyline(${recordedTrack.path})`.as("polyline"),
      pointTimestamps: recordedTrack.pointTimestamps,
      pointSpeed: recordedTrack.pointSpeed,
      pointSpeedAccuracy: recordedTrack.pointSpeedAccuracy,
      pointGpsElevation: recordedTrack.pointGpsElevation,
      pointHorizontalAccuracy: recordedTrack.pointHorizontalAccuracy,
      pointVerticalAccuracy: recordedTrack.pointVerticalAccuracy,
      pointBearing: recordedTrack.pointBearing,
      pointBearingAccuracy: recordedTrack.pointBearingAccuracy,
    })
    .from(recordedTrack)
    .where(
      and(eq(recordedTrack.id, trackId), eq(recordedTrack.userId, userId)),
    );

  if (!row) return null;

  return {
    ...toSummary(row),
    polyline: row.polyline!,
    pointTimestamps: row.pointTimestamps,
    pointSpeed: row.pointSpeed,
    pointSpeedAccuracy: row.pointSpeedAccuracy,
    pointGpsElevation: row.pointGpsElevation,
    pointHorizontalAccuracy: row.pointHorizontalAccuracy,
    pointVerticalAccuracy: row.pointVerticalAccuracy,
    pointBearing: row.pointBearing,
    pointBearingAccuracy: row.pointBearingAccuracy,
  };
}

function toSummary(row: {
  id: string;
  name: string | null;
  startTime: Date;
  endTime: Date | null;
  createdAt: Date;
  distanceM: number | null;
  durationMs: number | null;
  summaryPolyline: string | null;
}): RecordedTrackSummary {
  return {
    id: row.id,
    name: row.name,
    startTime: row.startTime.getTime(),
    endTime: row.endTime?.getTime() ?? null,
    createdAt: row.createdAt.getTime(),
    distanceM: row.distanceM,
    durationMs: row.durationMs,
    summaryPolyline: row.summaryPolyline!,
  };
}

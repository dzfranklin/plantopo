import { lineString } from "@turf/helpers";
import { and, eq, isNull, sql } from "drizzle-orm";
import z from "zod";

import { type LocalRecordedTrack } from "@pt/shared";

import { db } from "../db.js";
import { getElevations } from "../elevation/elevation.service.js";
import { env } from "../env.js";
import { enqueueJob } from "../jobs.js";
import { getLog } from "../logger.js";
import { lineStringFromDriver } from "../postgis.js";
import { renderStaticMap } from "../staticmap/staticmap.js";
import { recordedTrack } from "./track.schema.js";

const PreviewSchema = z.object({
  src: z.string(),
  width: z.number(),
  height: z.number(),
});

export const RecordedTrackSummarySchema = z.object({
  id: z.string(),
  name: z.string().nullable(),
  startTime: z.number(), // epoch ms
  endTime: z.number(), // epoch ms
  createdAt: z.number(), // epoch ms
  distanceM: z.number(),
  durationMs: z.number(),
  preview: PreviewSchema.nullable(),
  previewSmall: PreviewSchema.nullable(),
});

export type RecordedTrackSummary = z.infer<typeof RecordedTrackSummarySchema>;

export const RecordedTrackSchema = RecordedTrackSummarySchema.extend({
  polyline: z.string(), // full resolution, for map/detail view
  pointTimestamps: z.array(z.number()),
  pointSpeed: z.array(z.number().nullable()).nullable(),
  pointDemElevation: z.array(z.number().nullable()).nullable(),
});

export type RecordedTrack = z.infer<typeof RecordedTrackSchema>;

export const RecordedTrackWithPointDetailSchema = RecordedTrackSchema.extend({
  pointSpeedAccuracy: z.array(z.number().nullable()).nullable(),
  pointGpsElevation: z.array(z.number().nullable()).nullable(),
  pointHorizontalAccuracy: z.array(z.number().nullable()).nullable(),
  pointVerticalAccuracy: z.array(z.number().nullable()).nullable(),
  pointBearing: z.array(z.number().nullable()).nullable(),
  pointBearingAccuracy: z.array(z.number().nullable()).nullable(),
});

export type RecordedTrackWithPointDetail = z.infer<
  typeof RecordedTrackWithPointDetailSchema
>;

export async function uploadRecordedTrack(
  userId: string,
  payload: Omit<LocalRecordedTrack, "status"> & { endTime: number },
) {
  const id = payload.id;
  const log = getLog().child({ userId, trackId: id });
  const pts = payload.points;

  if (pts.length < 2) {
    log.warn({ payload }, "Track has fewer than 2 points, rejecting");
    return;
  }

  const path = JSON.stringify({
    type: "LineString",
    coordinates: pts.map(p => [p.longitude, p.latitude]),
  });

  // On my phone I've noticed bearing and bearingAccuracy can have some null values
  // even if generally present.
  const nullableArray = <T>(arr: (T | null)[]): T[] | null =>
    arr.every(v => v === null) ? null : (arr as T[]);

  await db
    .insert(recordedTrack)
    .values({
      id,
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

  await enqueuePopulateDemElevationJob(id);
  await enqueuePopulatePreviewImagesJob(id);

  log.info("uploadedRecordedTrack");
}

export async function enqueuePopulateDemElevationJob(trackId: string) {
  return await enqueueJob(
    "recordedTrack.populateDemElevation",
    { trackId },
    { jobId: "recordedTrack.populateDemElevation." + trackId },
  );
}

export async function populateDemElevation(trackId: string): Promise<void> {
  const log = getLog().child({ trackId });

  const [row] = await db
    .select({ path: recordedTrack.path })
    .from(recordedTrack)
    .where(
      and(
        eq(recordedTrack.id, trackId),
        isNull(recordedTrack.pointDemElevation),
      ),
    );

  if (!row) {
    log.info("populateDemElevation: track not found or already populated");
    return;
  }

  const { data } = await getElevations(row.path, []);

  await db
    .update(recordedTrack)
    .set({ pointDemElevation: data })
    .where(eq(recordedTrack.id, trackId));

  log.info("populateDemElevation: done");
}

export async function enqueuePopulatePreviewImagesJob(trackId: string) {
  return await enqueueJob(
    "recordedTrack.populatePreviewImages",
    { trackId },
    { jobId: "recordedTrack.populatePreviewImages." + trackId },
  );
}

export async function populatePreviewImages(
  trackId: string,
  tileProvider?: Parameters<typeof renderStaticMap>[0]["tileProvider"],
): Promise<void> {
  const log = getLog().child({ trackId });

  const [row] = await db
    .select({
      path: sql`ST_Simplify(${recordedTrack.path}, 0.00001)`.as("path"),
    })
    .from(recordedTrack)
    .where(
      and(eq(recordedTrack.id, trackId), isNull(recordedTrack.previewLargeSrc)),
    );

  if (!row) {
    log.info("populatePreviewImages: track not found or already populated");
    return;
  }

  const coords = lineStringFromDriver(row.path);
  const features = [
    lineString(coords, { stroke: "#ffffff", "stroke-width": 10 }),
    lineString(coords, { stroke: "#2563eb", "stroke-width": 4 }),
  ];

  const width = 600;
  const height = width / 4;
  const smallWidth = 300;
  const smallHeight = smallWidth / 4;

  const [largeBuf, smallBuf] = await Promise.all([
    renderStaticMap({
      width,
      height,
      retina: true,
      padding: 10,
      features,
      tileProvider,
    }),
    renderStaticMap({
      width: smallWidth,
      height: smallHeight,
      retina: true,
      padding: 10,
      features,
      tileProvider,
    }),
  ]);

  await db
    .update(recordedTrack)
    .set({
      previewLargeSrc: largeBuf,
      previewLargeWidth: width,
      previewLargeHeight: height,
      previewSmallSrc: smallBuf,
      previewSmallWidth: smallWidth,
      previewSmallHeight: smallHeight,
    })
    .where(eq(recordedTrack.id, trackId));

  log.info("populatePreviewImages: done");
}

const summaryColumns = {
  id: recordedTrack.id,
  name: recordedTrack.name,
  startTime: recordedTrack.startTime,
  endTime: recordedTrack.endTime,
  createdAt: recordedTrack.createdAt,
  distanceM: sql<number>`ST_Length(${recordedTrack.path}::geography)`.as(
    "distance_m",
  ),
  durationMs:
    sql<number>`(EXTRACT(EPOCH FROM (${recordedTrack.endTime} - ${recordedTrack.startTime})) * 1000)::float8`.as(
      "duration_ms",
    ),
  previewLargeWidth: recordedTrack.previewLargeWidth,
  previewLargeHeight: recordedTrack.previewLargeHeight,
  previewSmallWidth: recordedTrack.previewSmallWidth,
  previewSmallHeight: recordedTrack.previewSmallHeight,
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
      pointDemElevation: recordedTrack.pointDemElevation,
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
    pointDemElevation: row.pointDemElevation,
  };
}

export async function getRecordedTrackPreview(
  userId: string,
  trackId: string,
  size: "large" | "small",
): Promise<{ buf: Buffer; width: number; height: number } | null> {
  const selectCols =
    size === "large"
      ? {
          buf: recordedTrack.previewLargeSrc,
          width: recordedTrack.previewLargeWidth,
          height: recordedTrack.previewLargeHeight,
        }
      : {
          buf: recordedTrack.previewSmallSrc,
          width: recordedTrack.previewSmallWidth,
          height: recordedTrack.previewSmallHeight,
        };

  const [row] = await db
    .select(selectCols)
    .from(recordedTrack)
    .where(
      and(eq(recordedTrack.id, trackId), eq(recordedTrack.userId, userId)),
    );
  if (!row) return null;

  const { buf, width, height } = row;
  if (!buf || !width || !height) return null;
  return { buf, width, height };
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
      pointDemElevation: recordedTrack.pointDemElevation,
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
    pointDemElevation: row.pointDemElevation,
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
  endTime: Date;
  createdAt: Date;
  distanceM: number;
  durationMs: number;
  previewLargeWidth: number | null;
  previewLargeHeight: number | null;
  previewSmallWidth: number | null;
  previewSmallHeight: number | null;
}): RecordedTrackSummary {
  const preview = (
    size: string,
    width: number | null,
    height: number | null,
  ) =>
    width && height
      ? {
          src: `${env.APP_URL}/api/v1/track/${row.id}/preview/${size}`,
          width,
          height,
        }
      : null;

  return {
    id: row.id,
    name: row.name,
    startTime: row.startTime.getTime(),
    endTime: row.endTime.getTime(),
    createdAt: row.createdAt.getTime(),
    distanceM: row.distanceM,
    durationMs: row.durationMs,
    preview: preview("large", row.previewLargeWidth, row.previewLargeHeight),
    previewSmall: preview(
      "small",
      row.previewSmallWidth,
      row.previewSmallHeight,
    ),
  };
}

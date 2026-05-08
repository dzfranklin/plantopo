import { lineString } from "@turf/helpers";
import { and, eq, isNull, sql } from "drizzle-orm";
import z from "zod";

import { type LocalRecordedTrack } from "@pt/shared";

import { db } from "../db.js";
import { getElevations } from "../elevation/elevation.service.js";
import { env } from "../env.js";
import { ImageSchema, listImagesByTrack } from "../image/image.service.js";
import { enqueueJob, resetJobsByName } from "../jobs.js";
import { getLog } from "../logger.js";
import { lineStringFromDriver } from "../postgis.js";
import { renderStaticMap } from "../staticmap/staticmap.js";
import { track } from "./track.schema.js";

const PreviewSchema = z.object({
  src: z.string(),
  width: z.number(),
  height: z.number(),
});

export const TrackSummarySchema = z.object({
  id: z.string(),
  name: z.string().optional(),
  description: z.string().optional(),
  startTime: z.number().optional(), // epoch ms
  endTime: z.number().optional(), // epoch ms
  createdAt: z.number(), // epoch ms
  distanceM: z.number(),
  durationMs: z.number(),
  preview: PreviewSchema.optional(),
  previewSmall: PreviewSchema.optional(),
});

export type TrackSummary = z.infer<typeof TrackSummarySchema>;

export const TrackSchema = TrackSummarySchema.extend({
  polyline: z.string(), // full resolution, for map/detail view
  pointTimestamps: z.array(z.number().nullable()).optional(),
  pointSpeed: z.array(z.number().nullable()).optional(),
  pointDemElevation: z.array(z.number().nullable()).optional(),
  images: z.array(ImageSchema),
  source: z
    .object({
      type: z.string(),
      id: z.string(),
      label: z.string(),
      color: z.string(),
      url: z.string().optional(),
    })
    .optional(),
});

export type Track = z.infer<typeof TrackSchema>;

export const TrackWithPointDetailSchema = TrackSchema.extend({
  pointSpeedAccuracy: z.array(z.number().nullable()).optional(),
  pointGpsElevation: z.array(z.number().nullable()).optional(),
  pointHorizontalAccuracy: z.array(z.number().nullable()).optional(),
  pointVerticalAccuracy: z.array(z.number().nullable()).optional(),
  pointBearing: z.array(z.number().nullable()).optional(),
  pointBearingAccuracy: z.array(z.number().nullable()).optional(),
});

export type TrackWithPointDetail = z.infer<typeof TrackWithPointDetailSchema>;

export async function updateTrack(
  userId: string,
  trackId: string,
  fields: { name?: string | null },
): Promise<void> {
  await db
    .update(track)
    .set({ name: fields.name })
    .where(and(eq(track.id, trackId), eq(track.userId, userId)));
}

export async function uploadTrack(
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
    .insert(track)
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

  log.info("uploadedTrack");
}

export async function enqueuePopulateDemElevationJob(trackId: string) {
  return await enqueueJob("track.populateDemElevation", { trackId });
}

export async function populateDemElevation(trackId: string): Promise<void> {
  const log = getLog().child({ trackId });

  const [row] = await db
    .select({ path: track.path })
    .from(track)
    .where(and(eq(track.id, trackId), isNull(track.pointDemElevation)));

  if (!row) {
    log.info("populateDemElevation: track not found or already populated");
    return;
  }

  const { data } = await getElevations(row.path, []);

  await db
    .update(track)
    .set({ pointDemElevation: data })
    .where(eq(track.id, trackId));

  log.info("populateDemElevation: done");
}

export async function enqueuePopulatePreviewImagesJob(trackId: string) {
  return await enqueueJob("track.populatePreviewImages", { trackId });
}

export async function resetPopulatePreviewImagesJobs() {
  return await resetJobsByName("track.populatePreviewImages");
}

export async function populatePreviewImages(
  trackId: string,
  tileProvider?: Parameters<typeof renderStaticMap>[0]["tileProvider"],
): Promise<void> {
  const log = getLog().child({ trackId });

  const [row] = await db
    .select({
      path: sql`ST_Simplify(${track.path}, 0.00001)`.as("path"),
    })
    .from(track)
    .where(and(eq(track.id, trackId), isNull(track.previewLargeSrc)));

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
    .update(track)
    .set({
      previewLargeSrc: largeBuf,
      previewLargeWidth: width,
      previewLargeHeight: height,
      previewSmallSrc: smallBuf,
      previewSmallWidth: smallWidth,
      previewSmallHeight: smallHeight,
    })
    .where(eq(track.id, trackId));

  log.info("populatePreviewImages: done");
}

const summaryColumns = {
  id: track.id,
  name: track.name,
  description: track.description,
  startTime: track.startTime,
  endTime: track.endTime,
  createdAt: track.createdAt,
  distanceM: sql<number>`ST_Length(${track.path}::geography)`.as("distance_m"),
  durationMs:
    sql<number>`(EXTRACT(EPOCH FROM (${track.endTime} - ${track.startTime})) * 1000)::float8`.as(
      "duration_ms",
    ),
  previewLargeWidth: track.previewLargeWidth,
  previewLargeHeight: track.previewLargeHeight,
  previewSmallWidth: track.previewSmallWidth,
  previewSmallHeight: track.previewSmallHeight,
};

const trackColumns = {
  ...summaryColumns,
  polyline: sql<string | null>`ST_AsEncodedPolyline(${track.path}, 6)`.as(
    "polyline",
  ),
  pointTimestamps: track.pointTimestamps,
  pointSpeed: track.pointSpeed,
  pointDemElevation: track.pointDemElevation,
  sourceType: track.sourceType,
  sourceId: track.sourceId,
};

export async function listTracks(userId: string): Promise<TrackSummary[]> {
  const rows = await db
    .select(summaryColumns)
    .from(track)
    .where(eq(track.userId, userId))
    .orderBy(sql`${track.startTime} DESC`);

  return rows.map(toSummary);
}

export async function getTrack(
  userId: string,
  trackId: string,
): Promise<Track | null> {
  const request = await db
    .select(trackColumns)
    .from(track)
    .where(and(eq(track.id, trackId), eq(track.userId, userId)))
    .then(rows => rows[0]);

  const [row, images] = await Promise.all([
    request,
    await listImagesByTrack(trackId),
  ]);
  if (!row) return null;

  return {
    ...toTrackObj(row),
    images,
  };
}

export async function getTrackPreview(
  userId: string,
  trackId: string,
  size: "large" | "small",
): Promise<{ buf: Buffer; width: number; height: number } | null> {
  const selectCols =
    size === "large"
      ? {
          buf: track.previewLargeSrc,
          width: track.previewLargeWidth,
          height: track.previewLargeHeight,
        }
      : {
          buf: track.previewSmallSrc,
          width: track.previewSmallWidth,
          height: track.previewSmallHeight,
        };

  const [row] = await db
    .select(selectCols)
    .from(track)
    .where(and(eq(track.id, trackId), eq(track.userId, userId)));
  if (!row) return null;

  const { buf, width, height } = row;
  if (!buf || !width || !height) return null;
  return { buf, width, height };
}

export async function getTrackWithPointDetail(
  userId: string,
  trackId: string,
): Promise<TrackWithPointDetail | null> {
  const [row] = await db
    .select({
      ...trackColumns,
      pointSpeedAccuracy: track.pointSpeedAccuracy,
      pointGpsElevation: track.pointGpsElevation,
      pointHorizontalAccuracy: track.pointHorizontalAccuracy,
      pointVerticalAccuracy: track.pointVerticalAccuracy,
      pointBearing: track.pointBearing,
      pointBearingAccuracy: track.pointBearingAccuracy,
    })
    .from(track)
    .where(and(eq(track.id, trackId), eq(track.userId, userId)));

  if (!row) return null;

  const images = await listImagesByTrack(trackId);

  return {
    ...toTrackObj(row),
    pointSpeedAccuracy: row.pointSpeedAccuracy ?? undefined,
    pointGpsElevation: row.pointGpsElevation ?? undefined,
    pointHorizontalAccuracy: row.pointHorizontalAccuracy ?? undefined,
    pointVerticalAccuracy: row.pointVerticalAccuracy ?? undefined,
    pointBearing: row.pointBearing ?? undefined,
    pointBearingAccuracy: row.pointBearingAccuracy ?? undefined,
    images,
  };
}

interface SummaryRow {
  id: string;
  name: string | null;
  description: string | null;
  startTime: Date | null;
  endTime: Date | null;
  createdAt: Date;
  distanceM: number;
  durationMs: number;
  previewLargeWidth: number | null;
  previewLargeHeight: number | null;
  previewSmallWidth: number | null;
  previewSmallHeight: number | null;
}

interface TrackRow extends SummaryRow {
  polyline: string | null;
  pointTimestamps: (number | null)[] | null;
  pointSpeed: (number | null)[] | null;
  pointDemElevation: (number | null)[] | null;
  sourceType: string | null;
  sourceId: string | null;
}

function toSummary(row: SummaryRow): TrackSummary {
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
      : undefined;

  return {
    ...row,
    name: row.name ?? undefined,
    startTime: row.startTime?.getTime(),
    endTime: row.endTime?.getTime(),
    createdAt: row.createdAt.getTime(),
    preview: preview("large", row.previewLargeWidth, row.previewLargeHeight),
    previewSmall: preview(
      "small",
      row.previewSmallWidth,
      row.previewSmallHeight,
    ),
    description: row.description ?? undefined,
  };
}

function toTrackObj(row: TrackRow): Omit<Track, "images"> {
  return {
    ...toSummary(row),
    polyline: row.polyline!,
    pointTimestamps: row.pointTimestamps ?? undefined,
    pointSpeed: row.pointSpeed ?? undefined,
    pointDemElevation: row.pointDemElevation ?? undefined,
    source: toSource(row),
  };
}

function toSource({
  sourceType: type,
  sourceId: id,
}: {
  sourceType: string | null;
  sourceId: string | null;
}): Track["source"] {
  if (!type || !id) return undefined;
  let label: string;
  let color = "gray";
  let url;
  switch (type) {
    case "strava":
      label = "Strava";
      color = "#d03f01";
      url = "https://www.strava.com/activities/" + id;
      break;
    default:
      label = type;
      color = "gray";
  }
  return { type: type, id, label, color, url };
}

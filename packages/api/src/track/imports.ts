import { sql } from "drizzle-orm";
import { nanoid } from "nanoid";
import z from "zod";

import type { Point2 } from "@pt/shared";

import { db } from "../db.js";
import { enqueueJob } from "../jobs.js";
import { getLog } from "../logger.js";
import { recordedTrack } from "./track.schema.js";
import {
  enqueuePopulateDemElevationJob,
  enqueuePopulatePreviewImagesJob,
} from "./track.service.js";

export interface ImportTrackOpts {
  userId: string;
  trackImport: TrackImport;
}

export async function importTrack(opts: ImportTrackOpts): Promise<void> {
  await enqueueJob("track.import", opts);
}

export async function runImportTrack(opts: ImportTrackOpts): Promise<string> {
  const { userId, trackImport } = opts;
  const { properties, geometry } = trackImport;
  let log = getLog().child({
    runImportTrackUserId: userId,
    runImportTrackSourceType: properties.sourceType,
    runImportTrackSourceId: properties.sourceId,
  });

  const pointTimestamps = properties.coordinateProperties.times ?? null;
  const pointSpeed = properties.coordinateProperties.speeds ?? null;

  const upsertData = {
    sourceType: properties.sourceType,
    sourceId: properties.sourceId,
    name: properties.name ?? null,
    description: properties.description ?? null,
    startTime: properties.startTime ? new Date(properties.startTime) : null,
    endTime: properties.endTime ? new Date(properties.endTime) : null,
    path: geometry.coordinates as Point2[],
    pointTimestamps,
    pointSpeed,
    pointDemElevation: null,
    previewLargeSrc: null,
    previewLargeWidth: null,
    previewLargeHeight: null,
    previewSmallSrc: null,
    previewSmallWidth: null,
    previewSmallHeight: null,
  };

  const row = await db
    .insert(recordedTrack)
    .values({ id: nanoid(), userId, ...upsertData })
    .onConflictDoUpdate({
      target: [
        recordedTrack.userId,
        recordedTrack.sourceType,
        recordedTrack.sourceId,
      ],
      targetWhere: sql`${recordedTrack.sourceType} IS NOT NULL`,
      set: upsertData,
    })
    .returning({ id: recordedTrack.id })
    .then(([row]) => row!);
  const trackId = row.id;

  log = log.child({ trackId });
  log.info("Track inserted");

  await enqueuePopulateDemElevationJob(trackId);
  await enqueuePopulatePreviewImagesJob(trackId);

  const photos = properties.photos ?? [];
  const { enqueueJob } = await import("../jobs.js");
  for (const photo of photos) {
    enqueueJob("image.import", {
      userId,
      url: photo.url,
      takenAt: photo.taken_at,
      filename: photo.filename,
      linkedTrackId: trackId,
    }).catch(err => {
      log.error({ err, photoUrl: photo.url }, "Failed to enqueue image import");
    });
  }

  log.info({ photoCount: photos.length }, "Track import complete");
  return trackId;
}

export class ImportError extends Error {
  constructor(message: string, cause?: unknown) {
    super(message, { cause });
    this.name = "ImportError";
  }
  cause?: unknown;
}

// Based on <https://github.com/mapbox/geojson-coordinate-properties>

export const CoordinatePropertiesSchema = z.object({
  times: z.array(z.number().nullable()).optional(),
  speeds: z.array(z.number().nullable()).optional(),
});

export type CoordinateProperties = z.infer<typeof CoordinatePropertiesSchema>;

export const PhotoSchema = z.object({
  url: z.url(),
  taken_at: z.string().optional(),
  filename: z.string().optional(),
});

export const PropertiesSchema = z.object({
  sourceType: z.string(), // e.g. "strava", "gpx"
  sourceId: z.string(), // e.g. strava activity id, or filename
  name: z.string().optional(),
  startTime: z.number().optional(),
  endTime: z.number().optional(),
  description: z.string().optional(),
  photos: z.array(PhotoSchema).optional(),
  coordinateProperties: CoordinatePropertiesSchema,
});

export type Properties = z.infer<typeof PropertiesSchema>;

export const GeometrySchema = z.object({
  type: z.literal("LineString"),
  coordinates: z.array(z.array(z.number()).min(2)),
});

export type Geometry = z.infer<typeof GeometrySchema>;

export const TrackImportSchema = z.object({
  type: z.literal("Feature"),
  properties: PropertiesSchema,
  geometry: GeometrySchema,
});

export type TrackImport = z.infer<typeof TrackImportSchema>;

export function normalizeFilenameComponent(input: string): string {
  return input.replace(/[^a-zA-Z0-9.\-_ ]/g, "_").slice(0, 255);
}

export function fileExtension(filename: string): string {
  const match = filename.match(/\.([a-zA-Z0-9]+)$/);
  return match ? match[1]!.toLowerCase() : "";
}

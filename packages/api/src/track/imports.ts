import { and, eq, inArray, isNotNull } from "drizzle-orm";
import { nanoid } from "nanoid";
import z from "zod";

import type { Point2 } from "@pt/shared";
import { sha256 } from "@pt/shared";

import { db } from "../db.js";
import { enqueueJob } from "../jobs.js";
import { getLog } from "../logger.js";
import { track, trackImport } from "./track.schema.js";
import {
  enqueuePopulateDemElevationJob,
  enqueuePopulatePreviewImagesJob,
} from "./track.service.js";

export interface TrackImportKey {
  userId: string;
  sourceType: string;
  sourceId: string;
}

export async function createTrackImport(key: TrackImportKey): Promise<void> {
  await db.insert(trackImport).values(key).onConflictDoNothing();
}

export async function setRawData(
  key: TrackImportKey,
  raw: Buffer,
): Promise<void> {
  await db
    .update(trackImport)
    .set({ rawData: raw })
    .where(
      and(
        eq(trackImport.userId, key.userId),
        eq(trackImport.sourceType, key.sourceType),
        eq(trackImport.sourceId, key.sourceId),
      ),
    );
}

export type ConversionInput =
  | { status: "already_converted" }
  | { status: "has_raw"; data: Buffer }
  | { status: "needs_fetch" };

export async function getConversionInput(
  key: TrackImportKey,
): Promise<ConversionInput> {
  const row = await db
    .select({
      rawData: trackImport.rawData,
      importData: trackImport.importData,
    })
    .from(trackImport)
    .where(
      and(
        eq(trackImport.userId, key.userId),
        eq(trackImport.sourceType, key.sourceType),
        eq(trackImport.sourceId, key.sourceId),
      ),
    )
    .then(r => r[0] ?? null);

  if (!row)
    throw new Error(
      `track_import row not found for ${key.sourceType}/${key.sourceId}`,
    );
  if (row.importData) return { status: "already_converted" };
  if (row.rawData) return { status: "has_raw", data: row.rawData as Buffer };
  return { status: "needs_fetch" };
}

export interface TrackImportOptions {
  force?: boolean;
}

export async function importTrack(
  key: TrackImportKey,
  data: TrackImport,
  options: TrackImportOptions = {},
): Promise<void> {
  await db
    .update(trackImport)
    .set({ importData: data as unknown as Record<string, unknown> })
    .where(
      and(
        eq(trackImport.userId, key.userId),
        eq(trackImport.sourceType, key.sourceType),
        eq(trackImport.sourceId, key.sourceId),
      ),
    );
  await enqueueJob("track.import", { key, options });
}

export async function runImportTrack({
  key,
  options,
}: {
  key: TrackImportKey;
  options?: TrackImportOptions;
}): Promise<string> {
  const { userId, sourceType, sourceId } = key;
  let log = getLog().child({
    runImportTrackUserId: userId,
    sourceType,
    sourceId,
  });

  const row = await db
    .select()
    .from(trackImport)
    .where(
      and(
        eq(trackImport.userId, userId),
        eq(trackImport.sourceType, sourceType),
        eq(trackImport.sourceId, sourceId),
      ),
    )
    .then(r => r[0] ?? null);

  if (!row) {
    throw new Error(`track_import row not found for ${sourceType}/${sourceId}`);
  }

  if (row.trackId) {
    if (options?.force) {
      log.info("force re-importing track");
    } else {
      log.info("Track already imported, skipping");
      return row.trackId;
    }
  }

  if (!row.importData) {
    throw new Error(
      `track_import.importData is null for ${sourceType}/${sourceId}`,
    );
  }

  const trackImportData = TrackImportSchema.parse(row.importData);
  const { properties, geometry } = trackImportData;

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

  const trackRow = await db
    .insert(track)
    .values({ id: nanoid(), userId, ...upsertData })
    .onConflictDoUpdate({
      target: [track.userId, track.sourceType, track.sourceId],
      targetWhere: isNotNull(track.sourceType),
      set: upsertData,
    })
    .returning({ id: track.id })
    .then(([r]) => r!);

  const trackId = trackRow.id;
  log = log.child({ trackId });
  log.info("Track inserted");

  await db
    .update(trackImport)
    .set({ trackId })
    .where(
      and(
        eq(trackImport.userId, userId),
        eq(trackImport.sourceType, sourceType),
        eq(trackImport.sourceId, sourceId),
      ),
    );

  await enqueuePopulateDemElevationJob(trackId);
  await enqueuePopulatePreviewImagesJob(trackId);

  const photos = properties.photos ?? [];
  for (const photo of photos) {
    const photoSha256 = await sha256(photo.url);
    enqueueJob("image.import", {
      userId,
      url: photo.url,
      takenAt: photo.taken_at,
      filename: photo.filename,
      linkedTrackId: trackId,
      sha256: photoSha256,
    }).catch(err => {
      log.error({ err, photoUrl: photo.url }, "Failed to enqueue image import");
    });
  }

  log.info({ photoCount: photos.length }, "Track import complete");
  return trackId;
}

export type ImportStatus = "none" | "pending" | "done" | "track_deleted";

export async function getImportStatus(
  userId: string,
  sourceType: string,
  sourceId: string,
): Promise<ImportStatus> {
  const row = await db
    .select({
      importData: trackImport.importData,
      trackId: trackImport.trackId,
    })
    .from(trackImport)
    .where(
      and(
        eq(trackImport.userId, userId),
        eq(trackImport.sourceType, sourceType),
        eq(trackImport.sourceId, sourceId),
      ),
    )
    .then(r => r[0] ?? null);

  return deriveStatus(row);
}

export async function getImportStatuses(
  userId: string,
  sourceType: string,
  sourceIds: string[],
): Promise<Map<string, ImportStatus>> {
  if (sourceIds.length === 0) return new Map();

  const rows = await db
    .select({
      sourceId: trackImport.sourceId,
      importData: trackImport.importData,
      trackId: trackImport.trackId,
    })
    .from(trackImport)
    .where(
      and(
        eq(trackImport.userId, userId),
        eq(trackImport.sourceType, sourceType),
        inArray(trackImport.sourceId, sourceIds),
      ),
    );

  const result = new Map<string, ImportStatus>();
  for (const row of rows) {
    result.set(row.sourceId, deriveStatus(row));
  }
  return result;
}

export async function deleteTrackImport(
  userId: string,
  sourceType: string,
  sourceId: string,
): Promise<void> {
  await db
    .delete(trackImport)
    .where(
      and(
        eq(trackImport.userId, userId),
        eq(trackImport.sourceType, sourceType),
        eq(trackImport.sourceId, sourceId),
      ),
    );
}

function deriveStatus(
  row: { importData: unknown; trackId: string | null } | null,
): ImportStatus {
  if (!row) return "none";
  if (row.trackId) return "done";
  if (row.importData) return "track_deleted";
  return "pending";
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
  sourceType: z.string(),
  sourceId: z.string(),
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

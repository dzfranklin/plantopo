import {
  DeleteObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { and, eq, lt, sql } from "drizzle-orm";
import { nanoid } from "nanoid";
import z from "zod";

import { db } from "../db.js";
import { env } from "../env.js";
import { ImageSrcSchema } from "../index.js";
import { getLog } from "../logger.js";
import { recordedTrackImage } from "../track/track.schema.js";
import { image } from "./image.schema.js";
import { imgproxy } from "./imgproxy.js";

export const s3 = new S3Client({
  endpoint: env.S3_ENDPOINT,
  credentials: {
    accessKeyId: env.S3_IMAGE_ACCESS_KEY_ID,
    secretAccessKey: env.S3_IMAGE_SECRET_ACCESS_KEY,
  },
});

const UPLOAD_TTL = 60 * 60; // 1 hour in seconds

export const ImageSchema = z.object({
  s3Key: z.string(),
  width: z.number(),
  height: z.number(),
  takenAt: z.string().nullable(),
  createdAt: z.number(),
  image: ImageSrcSchema,
  imageSmallSquare: ImageSrcSchema,
});

export type ImageInfo = z.infer<typeof ImageSchema>;

export async function listImagesByTrack(trackId: string): Promise<ImageInfo[]> {
  const rows = await db
    .select({
      s3Key: image.s3Key,
      width: image.width,
      height: image.height,
      takenAt: image.takenAt,
      createdAt: image.createdAt,
    })
    .from(recordedTrackImage)
    .innerJoin(image, eq(recordedTrackImage.imageS3Key, image.s3Key))
    .where(
      and(eq(recordedTrackImage.trackId, trackId), eq(image.uploaded, true)),
    )
    .orderBy(sql`${image.createdAt} ASC`);

  return rows.map(toImageInfo);
}

export async function listImagesByUser(userId: string): Promise<ImageInfo[]> {
  const rows = await db
    .select({
      s3Key: image.s3Key,
      width: image.width,
      height: image.height,
      takenAt: image.takenAt,
      createdAt: image.createdAt,
    })
    .from(image)
    .where(and(eq(image.userId, userId), eq(image.uploaded, true)))
    .orderBy(sql`${image.createdAt} DESC`);

  return rows.map(toImageInfo);
}

export async function requestUpload(
  userId: string,
  opts: {
    linkedTrackId?: string;
    sha256: string;
    mimeType: string;
    size: number;
    width: number;
    height: number;
    takenAt?: string;
    location?: { lat: number; lng: number };
    exif?: Record<string, unknown>;
  },
): Promise<{ s3Key: string; uploadUrl: string | null }> {
  const [existing] = await db
    .select({ s3Key: image.s3Key, uploaded: image.uploaded })
    .from(image)
    .where(and(eq(image.userId, userId), eq(image.sha256, opts.sha256)));

  if (existing?.uploaded) {
    if (opts.linkedTrackId) {
      await db
        .insert(recordedTrackImage)
        .values({ trackId: opts.linkedTrackId, imageS3Key: existing.s3Key })
        .onConflictDoNothing();
    }
    return { s3Key: existing.s3Key, uploadUrl: null };
  }

  const s3Key = existing?.s3Key ?? `users/${userId}/${nanoid(40)}`;
  const takenAt = opts.takenAt ? normalizeExifDate(opts.takenAt) : null;

  const uploadUrl = await getSignedUrl(
    s3,
    new PutObjectCommand({
      Bucket: env.S3_IMAGE_BUCKET,
      Key: s3Key,
      ContentType: opts.mimeType,
      ContentLength: opts.size,
    }),
    { expiresIn: UPLOAD_TTL },
  );

  if (!existing) {
    await db.insert(image).values({
      s3Key,
      userId,
      sha256: opts.sha256,
      mimeType: opts.mimeType,
      size: opts.size,
      width: opts.width,
      height: opts.height,
      uploaded: false,
      takenAt,
      location: opts.location ?? null,
      exif: opts.exif ?? null,
    });

    if (opts.linkedTrackId) {
      await db
        .insert(recordedTrackImage)
        .values({ trackId: opts.linkedTrackId, imageS3Key: s3Key })
        .onConflictDoNothing();
    }
  }

  return { s3Key, uploadUrl };
}

export async function confirmUpload(s3Key: string): Promise<void> {
  await db.update(image).set({ uploaded: true }).where(eq(image.s3Key, s3Key));
}

export async function unlinkImageFromTrack(
  s3Key: string,
  trackId: string,
): Promise<void> {
  await db
    .delete(recordedTrackImage)
    .where(
      and(
        eq(recordedTrackImage.imageS3Key, s3Key),
        eq(recordedTrackImage.trackId, trackId),
      ),
    );
}

export async function deleteImage(s3Key: string): Promise<void> {
  await s3.send(
    new DeleteObjectCommand({ Bucket: env.S3_IMAGE_BUCKET, Key: s3Key }),
  );

  await db
    .delete(recordedTrackImage)
    .where(eq(recordedTrackImage.imageS3Key, s3Key));
  await db.delete(image).where(eq(image.s3Key, s3Key));
}

export async function sweepUnconfirmedImages(): Promise<void> {
  const log = getLog();
  const cutoff = new Date(Date.now() - 60 * 60 * 1000); // 1 hour ago

  const orphans = await db
    .select({ s3Key: image.s3Key })
    .from(image)
    .where(and(eq(image.uploaded, false), lt(image.createdAt, cutoff)));

  if (orphans.length === 0) return;

  log.info({ count: orphans.length }, "Sweeping unconfirmed images");

  for (const { s3Key } of orphans) {
    try {
      await db
        .delete(recordedTrackImage)
        .where(eq(recordedTrackImage.imageS3Key, s3Key));
      await db.delete(image).where(eq(image.s3Key, s3Key));
    } catch (err) {
      log.error({ err, s3Key }, "Failed to sweep unconfirmed image");
    }
  }
}

function toImageInfo(row: {
  s3Key: string;
  width: number;
  height: number;
  takenAt: string | null;
  createdAt: Date;
}): ImageInfo {
  return {
    s3Key: row.s3Key,
    width: row.width,
    height: row.height,
    takenAt: row.takenAt,
    createdAt: row.createdAt.getTime(),
    image: imgproxy(imageURI(row.s3Key), {
      width: row.width,
      height: row.height,
      maxSize: 2048,
    }),
    imageSmallSquare: imgproxy(imageURI(row.s3Key), {
      width: 300,
      height: 300,
      resizing_type: "fill",
      gravity: { type: "sm" },
    }),
  };
}

function imageURI(s3Key: string): string {
  if (env.S3_IMAGE_BUCKET.endsWith("-dev")) {
    // For development use public buckets so that we can reuse the production imgproxy instance
    const url = new URL(env.S3_ENDPOINT);
    url.hostname = `${env.S3_IMAGE_BUCKET}.${url.hostname}`;
    url.pathname = `/${s3Key}`;
    return url.toString();
  } else {
    return `s3://${env.S3_IMAGE_BUCKET}/${s3Key}`;
  }
}

// Parse EXIF date "YYYY:MM:DD HH:MM:SS" → "YYYY-MM-DDTHH:MM:SS"
function normalizeExifDate(raw: string): string | null {
  const m = raw.match(/^(\d{4}):(\d{2}):(\d{2})\s(\d{2}:\d{2}:\d{2})$/);
  if (!m) return null;
  return `${m[1]}-${m[2]}-${m[3]}T${m[4]}`;
}

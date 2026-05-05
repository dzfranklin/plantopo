import {
  DeleteObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { and, asc, desc, eq, lt } from "drizzle-orm";
import { nanoid } from "nanoid";
import z from "zod";

import { db } from "../db.js";
import { env } from "../env.js";
import { type ImageSrc, ImageSrcSchema } from "../index.js";
import { getLog } from "../logger.js";
import { recordedTrackImage } from "../track/track-image.schema.js";
import { image } from "./image.schema.js";
import { generateImgproxyRawUrl, imgproxy } from "./imgproxy.js";

export const s3 = new S3Client({
  endpoint: env.S3_ENDPOINT,
  region: env.S3_REGION,
  credentials: {
    accessKeyId: env.S3_IMAGE_ACCESS_KEY_ID,
    secretAccessKey: env.S3_IMAGE_SECRET_ACCESS_KEY,
  },
});

const UPLOAD_TTL = 60 * 60; // 1 hour in seconds

export const ImageSchema = z.object({
  id: z.string(),
  filename: z.string(),
  takenAt: z.string().nullable(),
  createdAt: z.number(),
  image: ImageSrcSchema,
  imageSmallSquare: ImageSrcSchema,
  originalImage: ImageSrcSchema,
});

export type ImageInfo = z.infer<typeof ImageSchema>;

const infoColumns = {
  s3Key: image.s3Key,
  filename: image.filename,
  width: image.width,
  height: image.height,
  takenAt: image.takenAt,
  createdAt: image.createdAt,
} as const;

export async function listImagesByTrack(trackId: string): Promise<ImageInfo[]> {
  const rows = await db
    .select(infoColumns)
    .from(recordedTrackImage)
    .innerJoin(image, eq(recordedTrackImage.imageS3Key, image.s3Key))
    .where(
      and(eq(recordedTrackImage.trackId, trackId), eq(image.uploaded, true)),
    )
    .orderBy(asc(recordedTrackImage.createdAt));

  return rows.map(toImageInfo);
}

export async function listImagesByUser(userId: string): Promise<ImageInfo[]> {
  const rows = await db
    .select(infoColumns)
    .from(image)
    .where(and(eq(image.userId, userId), eq(image.uploaded, true)))
    .orderBy(desc(image.createdAt));

  return rows.map(toImageInfo);
}

export const RequestUploadSchema = z.object({
  linkedTrackId: z.string().optional(),
  filename: z.string().max(255),
  sha256: z.string().length(64),
  mimeType: z.string(),
  size: z.number().int().positive(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  takenAt: z.string().optional(),
  location: z.object({ lat: z.number(), lng: z.number() }).optional(),
  exif: z.record(z.string(), z.unknown()).optional(),
});

export type RequestUpload = z.infer<typeof RequestUploadSchema>;

export const RequestUploadResponseSchema = z.object({
  s3Key: z.string(),
  uploadUrl: z.url().nullable(),
  preview: ImageSrcSchema.nullable(),
});

export type RequestUploadResponse = z.infer<typeof RequestUploadResponseSchema>;

export async function requestUpload(
  userId: string,
  opts: RequestUpload,
): Promise<RequestUploadResponse> {
  const takenAt = opts.takenAt ? normalizeExifDate(opts.takenAt) : null;

  const { s3Key, uploaded: alreadyUploaded } = await db
    .insert(image)
    .values({
      s3Key: `users/${userId}/${nanoid(40)}`,
      userId,
      filename: opts.filename,
      sha256: opts.sha256,
      mimeType: opts.mimeType,
      size: opts.size,
      width: opts.width,
      height: opts.height,
      uploaded: false,
      takenAt,
      location: opts.location ?? null,
      exif: opts.exif ?? null,
    })
    .onConflictDoUpdate({
      target: [image.userId, image.sha256],
      set: {
        filename: opts.filename,
        mimeType: opts.mimeType,
        size: opts.size,
        width: opts.width,
        height: opts.height,
        takenAt,
        location: opts.location ?? null,
        exif: opts.exif ?? null,
      },
    })
    .returning({ s3Key: image.s3Key, uploaded: image.uploaded })
    .then(r => r[0]!);

  if (alreadyUploaded) {
    if (opts.linkedTrackId) {
      await db
        .insert(recordedTrackImage)
        .values({ trackId: opts.linkedTrackId, imageS3Key: s3Key })
        .onConflictDoNothing();
    }

    return {
      s3Key,
      uploadUrl: null,
      preview: imageSmallSquare(s3Key),
    };
  }

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

  if (opts.linkedTrackId) {
    await db
      .insert(recordedTrackImage)
      .values({ trackId: opts.linkedTrackId, imageS3Key: s3Key })
      .onConflictDoNothing();
  }

  return { s3Key, uploadUrl, preview: null };
}

export const ConfirmUploadResponseSchema = z.object({
  preview: ImageSrcSchema,
});

export type ConfirmUploadResponse = z.infer<typeof ConfirmUploadResponseSchema>;

export async function confirmUpload(
  s3Key: string,
): Promise<ConfirmUploadResponse> {
  await db.update(image).set({ uploaded: true }).where(eq(image.s3Key, s3Key));
  return { preview: imageSmallSquare(s3Key) };
}

export async function isImageOwnedBy({
  s3Key,
  userId,
}: {
  s3Key: string;
  userId: string;
}): Promise<boolean> {
  const [row] = await db
    .select({ userId: image.userId })
    .from(image)
    .where(eq(image.s3Key, s3Key));

  return !!row && row.userId === userId;
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

function toImageInfo({
  createdAt,
  s3Key,
  width,
  height,
  ...rest
}: {
  s3Key: string;
  filename: string;
  width: number;
  height: number;
  takenAt: string | null;
  createdAt: Date;
}): ImageInfo {
  return {
    ...rest,
    id: s3Key,
    createdAt: createdAt.getTime(),
    image: imgproxy(imageURI(s3Key), {
      width: width,
      height: height,
      maxSize: 2048,
    }),
    imageSmallSquare: imageSmallSquare(s3Key),
    originalImage: {
      width,
      height,
      src: generateImgproxyRawUrl(imageURI(s3Key), rest.filename),
    },
  };
}

function imageSmallSquare(s3Key: string): ImageSrc {
  return imgproxy(imageURI(s3Key), {
    width: 300,
    height: 300,
    resizing_type: "fill",
    gravity: { type: "sm" },
  });
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

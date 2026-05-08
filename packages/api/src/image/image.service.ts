import {
  DeleteObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { TRPCError } from "@trpc/server";
import { and, asc, desc, eq, lt } from "drizzle-orm";
import exifr from "exifr";
import { nanoid } from "nanoid";
import sharp from "sharp";
import z from "zod";

import { cleanExifRecord, normalizeExifDate, sha256 } from "@pt/shared";

import { db } from "../db.js";
import { env } from "../env.js";
import { type ImageSrc, ImageSrcSchema } from "../index.js";
import { enqueueJob } from "../jobs.js";
import { getLog } from "../logger.js";
import { recordedTrackImage } from "../track/track-image.schema.js";
import { image } from "./image.schema.js";
import { generateImgproxyRawUrl, imgproxy } from "./imgproxy.js";

export const s3 = new S3Client({
  endpoint: env.S3_ENDPOINT,
  region: env.S3_REGION,
  forcePathStyle: env.S3_FORCE_PATH_STYLE,
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

export async function getImage(s3Key: string): Promise<ImageInfo | null> {
  const row = await db
    .select(infoColumns)
    .from(image)
    .where(and(eq(image.s3Key, s3Key), eq(image.uploaded, true)))
    .then(r => r[0] ?? null);

  return row ? toImageInfo(row) : null;
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
  const takenAt = opts.takenAt ?? null;

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

  if (opts.linkedTrackId) {
    await linkImageToTrack(s3Key, opts.linkedTrackId);
  }

  if (alreadyUploaded) {
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

  return { s3Key, uploadUrl, preview: null };
}

export async function confirmUpload(s3Key: string): Promise<ImageInfo> {
  const rows = await db
    .update(image)
    .set({ uploaded: true })
    .where(eq(image.s3Key, s3Key))
    .returning(infoColumns);
  if (!rows.length) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Image not found" });
  }
  return toImageInfo(rows[0]!);
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

export async function linkImageToTrack(
  s3Key: string,
  trackId: string,
): Promise<void> {
  await db
    .insert(recordedTrackImage)
    .values({ trackId, imageS3Key: s3Key })
    .onConflictDoNothing();
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

export async function sweepUnconfirmedImages(cutoff?: Date): Promise<number> {
  const log = getLog();
  cutoff = cutoff ?? new Date(Date.now() - 60 * 60 * 1000); // 1 hour ago

  const orphans = await db
    .select({ s3Key: image.s3Key })
    .from(image)
    .where(and(eq(image.uploaded, false), lt(image.createdAt, cutoff)));

  if (orphans.length === 0) return 0;

  log.info({ count: orphans.length }, "Sweeping unconfirmed images");

  for (const { s3Key } of orphans) {
    try {
      await db.delete(image).where(eq(image.s3Key, s3Key));
    } catch (err) {
      log.error({ err, s3Key }, "Failed to sweep unconfirmed image");
    }
  }

  return orphans.length;
}

export interface ImportImageOpts {
  userId: string;
  url: string;
  takenAt?: string;
  filename?: string;
  linkedTrackId?: string;
  sha256?: string;
}

export async function importImage(opts: ImportImageOpts): Promise<void> {
  await enqueueJob("image.import", opts);
}

export async function runImportImage(
  opts: ImportImageOpts,
): Promise<ImageInfo> {
  const log = getLog().child({ runImportImageURL: opts.url });

  // If caller provides a sha256, check if we already have this image and skip the fetch
  if (opts.sha256) {
    const existing = await db
      .select(infoColumns)
      .from(image)
      .where(
        and(
          eq(image.userId, opts.userId),
          eq(image.sha256, opts.sha256),
          eq(image.uploaded, true),
        ),
      )
      .then(r => r[0] ?? null);

    if (existing) {
      log.info("Image already exists, skipping fetch");
      if (opts.linkedTrackId) {
        await linkImageToTrack(existing.s3Key, opts.linkedTrackId);
      }
      return toImageInfo(existing);
    }
  }

  const response = await fetch(opts.url);
  if (!response.ok) {
    throw new Error(
      `Failed to fetch image: ${response.status} ${response.statusText}`,
    );
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  const size = buffer.byteLength;

  const sharpMeta = await sharp(buffer).metadata();

  const mimeType =
    response.headers.get("content-type")?.split(";")[0]?.trim() ||
    (sharpMeta.format
      ? `image/${sharpMeta.format}`
      : "application/octet-stream");

  const filename = opts.filename ?? deriveFilename(opts.url, mimeType);

  if (!sharpMeta.width || !sharpMeta.height) {
    throw new Error("Could not determine image dimensions");
  }
  const width = sharpMeta.width;
  const height = sharpMeta.height;

  const hash = opts.sha256 ?? (await sha256(filename, buffer.buffer));

  let takenAt = opts.takenAt;
  let location: { lat: number; lng: number } | undefined;
  let exifData: Record<string, unknown> | undefined;
  try {
    const parsed = await exifr.parse(buffer, { reviveValues: false });
    if (parsed) {
      if (!takenAt && parsed.DateTimeOriginal) {
        takenAt = normalizeExifDate(parsed.DateTimeOriginal) ?? undefined;
      }
      if (
        typeof parsed.latitude === "number" &&
        typeof parsed.longitude === "number"
      ) {
        location = { lat: parsed.latitude, lng: parsed.longitude };
      }
      exifData = cleanExifRecord(parsed);
    }
  } catch (err) {
    log.warn({ err }, "Failed to parse EXIF data during import");
  }

  log.info(
    { filename, mimeType, size, width, height, takenAt, location },
    "Parsed image metadata",
  );
  const uploadResponse = await requestUpload(opts.userId, {
    linkedTrackId: opts.linkedTrackId,
    filename,
    sha256: hash,
    mimeType,
    size,
    width,
    height,
    takenAt,
    location,
    exif: exifData,
  });

  const { s3Key, uploadUrl } = uploadResponse;
  log.info({ alreadyExists: !uploadUrl }, "Requested upload");

  if (uploadUrl) {
    await s3.send(
      new PutObjectCommand({
        Bucket: env.S3_IMAGE_BUCKET,
        Key: s3Key,
        Body: buffer,
        ContentType: mimeType,
        ContentLength: size,
      }),
    );
  }

  const result = confirmUpload(s3Key);
  log.info("Upload complete");
  return result;
}

function deriveFilename(url: string, mimeType: string): string {
  let name = new URL(url).pathname.split("/").pop() ?? "image";
  if (!name) name = "image";

  const extByMime: Record<string, string> = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/gif": ".gif",
    "image/webp": ".webp",
    "image/heic": ".heic",
    "image/heif": ".heif",
    "image/tiff": ".tiff",
    "image/avif": ".avif",
  };
  const expectedExt = extByMime[mimeType];
  if (expectedExt && !name.toLowerCase().endsWith(expectedExt)) {
    name = name.replace(/\.[^.]*$/, "") || name;
    name += expectedExt;
  }
  return name;
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

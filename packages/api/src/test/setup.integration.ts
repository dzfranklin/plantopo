import "../env/load.js";

import {
  DeleteObjectsCommand,
  ListObjectsV2Command,
  S3Client,
} from "@aws-sdk/client-s3";
import { Redis } from "ioredis";
import { beforeEach } from "vitest";

import { resetDb } from "./setup-db.js";

beforeEach(async () => {
  await Promise.all([resetDb(), resetRedis(), resetMinio()]);
});

export async function resetMinio() {
  const bucket = process.env.S3_IMAGE_BUCKET!;
  const s3 = new S3Client({
    endpoint: process.env.S3_ENDPOINT,
    region: process.env.S3_REGION,
    forcePathStyle: true,
    credentials: {
      accessKeyId: process.env.S3_IMAGE_ACCESS_KEY_ID!,
      secretAccessKey: process.env.S3_IMAGE_SECRET_ACCESS_KEY!,
    },
  });
  const { Contents } = await s3.send(
    new ListObjectsV2Command({ Bucket: bucket }),
  );
  if (!Contents?.length) return;
  await s3.send(
    new DeleteObjectsCommand({
      Bucket: bucket,
      Delete: { Objects: Contents.map(({ Key }) => ({ Key })) },
    }),
  );
}

export async function resetRedis(redisUrl?: string) {
  redisUrl ??= process.env.REDIS_URL;
  if (!redisUrl) {
    throw new Error("REDIS_URL is not set");
  }
  const client = new Redis(redisUrl);
  await client.flushdb();
  await client.quit();
}

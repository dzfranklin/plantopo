import "../env/load.js";

import {
  CreateBucketCommand,
  HeadBucketCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { MinioContainer, StartedMinioContainer } from "@testcontainers/minio";
import { PostgreSqlContainer } from "@testcontainers/postgresql";
import { RedisContainer } from "@testcontainers/redis";
import { Wait } from "testcontainers";

import { setupDb } from "./setup-db.js";

const S3_IMAGE_BUCKET = "plantopo-images-test";

export async function setup() {
  const [pg, redis, minio] = await Promise.all([
    new PostgreSqlContainer("postgis/postgis:18-3.6")
      .withUsername("postgres")
      .withPassword("postgres")
      .withDatabase("plantopo_test")
      .withReuse()
      .withWaitStrategy(
        Wait.forAll([
          Wait.forLogMessage(
            /database system is ready to accept connections/,
            2,
          ),
          Wait.forSuccessfulCommand("pg_isready -U postgres"),
        ]),
      )
      .start(),
    new RedisContainer("redis:7-alpine").withReuse().start(),
    new MinioContainer("minio/minio:RELEASE.2025-09-07T16-13-09Z")
      .withReuse()
      .start(),
  ]);

  const databaseUrl = pg.getConnectionUri();
  process.env.DATABASE_URL = databaseUrl;

  const redisUrl = `redis://${redis.getHost()}:${redis.getMappedPort(6379)}`;
  process.env.REDIS_URL = redisUrl;

  const s3Endpoint = minio.getConnectionUrl();
  process.env.S3_ENDPOINT = s3Endpoint;
  process.env.S3_REGION = "us-east-1";
  process.env.S3_FORCE_PATH_STYLE = "true";
  process.env.S3_IMAGE_BUCKET = S3_IMAGE_BUCKET;
  process.env.S3_IMAGE_ACCESS_KEY_ID = minio.getUsername();
  process.env.S3_IMAGE_SECRET_ACCESS_KEY = minio.getPassword();

  await Promise.all([setupDb(databaseUrl), setupMinio(minio)]);

  // If TESTCONTAINERS_REUSE_ENABLE is set, containers are not stopped
}

async function setupMinio(minio: StartedMinioContainer) {
  const s3 = new S3Client({
    endpoint: minio.getConnectionUrl(),
    region: "us-east-1",
    credentials: {
      accessKeyId: minio.getUsername(),
      secretAccessKey: minio.getPassword(),
    },
    forcePathStyle: true,
  });

  const bucketExists = await s3
    .send(new HeadBucketCommand({ Bucket: S3_IMAGE_BUCKET }))
    .then(() => true)
    .catch(() => false);

  if (!bucketExists) {
    await s3.send(new CreateBucketCommand({ Bucket: S3_IMAGE_BUCKET }));
  }
}

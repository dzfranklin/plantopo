import { eq } from "drizzle-orm";
import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import db from "../db.js";
import { getEnqueuedJobs } from "../test/helpers.js";
import { TEST_TRACK, TEST_USER } from "../test/setup-db.js";
import { track } from "../track/track.schema.js";
import { image } from "./image.schema.js";
import {
  getImage,
  importImage,
  listImagesByTrack,
  runImportImage,
} from "./image.service.js";

const FIXTURE = new URL("../test/fixtures/test.jpg", import.meta.url);

describe("runImportImage", () => {
  let serverUrl: string;

  beforeAll(async () => {
    const jpg = await readFile(FIXTURE);
    const server = createServer((_req, res) => {
      res.writeHead(200, { "Content-Type": "image/jpeg" });
      res.end(jpg);
    });
    await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
    const addr = server.address() as { port: number };
    serverUrl = `http://127.0.0.1:${addr.port}/test.jpg`;
    afterAll(
      () =>
        new Promise<void>((resolve, reject) =>
          server.close(err => (err ? reject(err) : resolve())),
        ),
    );
  });

  it("imports and stores image with correct metadata", async () => {
    const trackRow = await db
      .insert(track)
      .values({ ...TEST_TRACK, id: "import-track" })
      .returning()
      .then(r => r[0]!);

    const result = await runImportImage({
      userId: TEST_USER.id,
      url: serverUrl,
      linkedTrackId: trackRow.id,
    });

    // stored and retrievable
    expect(await getImage(result.id)).toMatchObject({ id: result.id });

    // dimensions, filename, and imgproxy URLs
    expect(result).toMatchObject({
      filename: "test.jpg",
      image: expect.objectContaining({
        src: expect.any(String),
        width: 120,
        height: 80,
      }),
      imageSmallSquare: expect.objectContaining({ src: expect.any(String) }),
      originalImage: expect.objectContaining({
        src: expect.any(String),
        width: 120,
        height: 80,
      }),
    });

    // EXIF takenAt and GPS
    expect(result.takenAt).toBe("2023-07-04T12:00:00");
    const [row] = await db
      .select({ location: image.location })
      .from(image)
      .where(eq(image.s3Key, result.id));
    expect(row!.location).toMatchObject({
      lat: expect.closeTo(51.5, 3),
      lng: expect.closeTo(-0.1275, 3),
    });

    // linked to track
    expect(await listImagesByTrack(trackRow.id)).toHaveLength(1);

    // deduplicates on re-import
    const second = await runImportImage({
      userId: TEST_USER.id,
      url: serverUrl,
    });
    expect(second.id).toBe(result.id);
  });

  it("derives filename extension from content-type when URL has none", async () => {
    const urlWithoutExt = `${new URL(serverUrl).origin}/photo`;
    const result = await runImportImage({
      userId: TEST_USER.id,
      url: urlWithoutExt,
    });
    expect(result.filename).toBe("photo.jpg");
  });

  it("uses provided takenAt over EXIF", async () => {
    const takenAt = "2024-06-15T10:30:00";
    const result = await runImportImage({
      userId: TEST_USER.id,
      url: serverUrl,
      takenAt,
    });
    expect(result.takenAt).toBe(takenAt);
  });
});

it("importImage enqueues an image.import job", async () => {
  await importImage({
    userId: TEST_USER.id,
    url: "https://example.com/photo.jpg",
  });

  const jobs = await getEnqueuedJobs("image.import");
  expect(jobs).toEqual([
    { userId: TEST_USER.id, url: "https://example.com/photo.jpg" },
  ]);
});

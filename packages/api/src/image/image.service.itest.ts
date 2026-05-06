import { beforeEach, describe, expect, it } from "vitest";

import db from "../db.js";
import { TEST_TRACK, TEST_USER2 } from "../test/setupDb.js";
import { recordedTrack } from "../track/track.schema.js";
import {
  type RequestUpload,
  confirmUpload,
  deleteImage,
  getImage,
  isImageOwnedBy,
  linkImageToTrack,
  listImagesByTrack,
  listImagesByUser,
  requestUpload,
  sweepUnconfirmedImages,
  unlinkImageFromTrack,
} from "./image.service.js";

function mockSha256(input?: string): string {
  return input?.padEnd(64, "0").slice(0, 64) ?? "0".repeat(64);
}

let nextHashInput = 1;
function requestUploadOpts(opts: Partial<RequestUpload> = {}): RequestUpload {
  return {
    filename: "test.jpg",
    sha256: mockSha256(String(nextHashInput++)),
    mimeType: "image/jpeg",
    size: 12345,
    width: 100,
    height: 100,
    ...opts,
  };
}

async function uploadAndConfirm(
  userId: string,
  opts: Partial<RequestUpload> = {},
) {
  const { s3Key } = await requestUpload(userId, requestUploadOpts(opts));
  await confirmUpload(s3Key);
  return s3Key;
}

let track: typeof recordedTrack.$inferSelect;
beforeEach(async () => {
  track = await db
    .insert(recordedTrack)
    .values({
      ...TEST_TRACK,
      id: "track",
    })
    .returning()
    .then(r => r[0]!);
});

it("listImagesByTrack returns empty array if no images", async () => {
  const result = await listImagesByTrack(track.id);
  expect(result).toEqual([]);
});

it("listImagesByUser returns empty array if no images", async () => {
  const result = await listImagesByUser(TEST_USER2.id);
  expect(result).toEqual([]);
});

describe("getImage", () => {
  it("returns null if image doesn't exist", async () => {
    const result = await getImage("non-existent");
    expect(result).toBeNull();
  });

  it("returns image info if exists", async () => {
    const s3Key = await uploadAndConfirm(track.userId);
    const result = await getImage(s3Key);
    expect(result).toEqual(expect.objectContaining({ id: s3Key }));
  });

  it("returns null if not confirmed", async () => {
    const { s3Key } = await requestUpload(track.userId, requestUploadOpts());
    const result = await getImage(s3Key);
    expect(result).toBeNull();
  });
});

it("confirmUpload fails for non-existent image", async () => {
  await expect(confirmUpload("non-existent")).rejects.toThrow();
});

it("images are listed after confirmation", async () => {
  expect(await listImagesByTrack(track.id)).toEqual([]);
  expect(await listImagesByUser(track.userId)).toEqual([]);

  const { s3Key } = await requestUpload(
    track.userId,
    requestUploadOpts({
      linkedTrackId: track.id,
      filename: "image.jpg",
    }),
  );

  expect(await listImagesByTrack(track.id)).toEqual([]);
  expect(await listImagesByUser(track.userId)).toEqual([]);

  await confirmUpload(s3Key);

  const expected = [
    expect.objectContaining({
      id: s3Key,
      filename: "image.jpg",
      image: expect.objectContaining({
        src: expect.any(String),
        height: expect.any(Number),
        width: expect.any(Number),
      }),
    }),
  ];
  expect(await listImagesByTrack(track.id)).toEqual(expected);
  expect(await listImagesByUser(track.userId)).toEqual(expected);
});

describe("isImageOwnedBy", () => {
  let s3Key: string;
  let userId: string;
  const otherUserId = TEST_USER2.id;
  beforeEach(async () => {
    userId = track.userId;
    s3Key = await uploadAndConfirm(userId);
  });

  it("returns true for owner", async () => {
    const result = await isImageOwnedBy({ s3Key, userId: userId });
    expect(result).toBe(true);
  });

  it("returns false for non-owner", async () => {
    const result = await isImageOwnedBy({ s3Key, userId: otherUserId });
    expect(result).toBe(false);
  });

  it("returns false for non-existent image", async () => {
    const result = await isImageOwnedBy({ s3Key: "non-existent", userId });
    expect(result).toBe(false);
  });

  it("returns false for non-existent user", async () => {
    const result = await isImageOwnedBy({ s3Key, userId: "non-existent" });
    expect(result).toBe(false);
  });

  it("returns true even if upload incomplete", async () => {
    const uploadResult = await requestUpload(userId, requestUploadOpts());
    expect(uploadResult.uploadUrl).toBeTruthy();
    const s3Key2 = uploadResult.s3Key;

    expect(await getImage(s3Key2)).toBeNull();

    const result = await isImageOwnedBy({ s3Key: s3Key2, userId });
    expect(result).toBe(true);
  });
});

it("linkImageToTrack and unlinkImageFromTrack", async () => {
  expect(await listImagesByTrack(track.id)).toHaveLength(0);

  const s3Key = await uploadAndConfirm(track.userId, {
    linkedTrackId: track.id,
  });
  expect(await listImagesByTrack(track.id)).toHaveLength(1);

  await unlinkImageFromTrack(s3Key, track.id);
  expect(await listImagesByTrack(track.id)).toHaveLength(0);

  // check doesn't delete
  expect(await getImage(s3Key)).not.toBeNull();

  // check can relink
  await linkImageToTrack(s3Key, track.id);
  expect(await listImagesByTrack(track.id)).toHaveLength(1);
});

describe("deleteImage", () => {
  it("deletes unlinked image", async () => {
    const s3Key = await uploadAndConfirm(track.userId);
    expect(await getImage(s3Key)).not.toBeNull();

    await deleteImage(s3Key);
    expect(await getImage(s3Key)).toBeNull();
  });

  it("deletes linked image", async () => {
    const s3Key = await uploadAndConfirm(track.userId, {
      linkedTrackId: track.id,
    });
    expect(await getImage(s3Key)).not.toBeNull();
    expect(await listImagesByTrack(track.id)).toHaveLength(1);

    await deleteImage(s3Key);
    expect(await getImage(s3Key)).toBeNull();
    expect(await listImagesByTrack(track.id)).toHaveLength(0);
  });
});

describe("sweepUnconfirmedImages", () => {
  it("returns 0 if no unconfirmed images", async () => {
    const result = await sweepUnconfirmedImages();
    expect(result).toBe(0);
  });

  it("deletes unconfirmed images older than cutoff", async () => {
    const { s3Key } = await requestUpload(track.userId, requestUploadOpts());

    const cutoff = new Date(Date.now() + 1000 * 60 * 60); // 1 hour in the future

    const result = await sweepUnconfirmedImages(cutoff);
    expect(result).toBe(1);

    await expect(confirmUpload(s3Key)).rejects.toThrow();
  });

  it("does not delete unconfirmed images newer than cutoff", async () => {
    const { s3Key } = await requestUpload(track.userId, requestUploadOpts());

    const result = await sweepUnconfirmedImages();
    expect(result).toBe(0);

    await expect(confirmUpload(s3Key)).resolves.not.toThrow();
  });
});

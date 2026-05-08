import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import db from "../db.js";
import { getEnqueuedJobs } from "../test/helpers.js";
import { TEST_USER } from "../test/setup-db.js";
import { type TrackImport, importTrack, runImportTrack } from "./imports.js";
import { track, trackImport } from "./track.schema.js";
import { getTrack } from "./track.service.js";

const BASE_IMPORT: TrackImport = {
  type: "Feature",
  geometry: {
    type: "LineString",
    coordinates: [
      [-0.1, 51.5],
      [-0.09, 51.51],
      [-0.08, 51.52],
    ],
  },
  properties: {
    sourceType: "strava",
    sourceId: "123456",
    name: "Morning run",
    description: "A nice run",
    startTime: new Date("2024-06-01T08:00:00Z").getTime(),
    endTime: new Date("2024-06-01T09:00:00Z").getTime(),
    coordinateProperties: {
      times: [
        new Date("2024-06-01T08:00:00Z").getTime(),
        new Date("2024-06-01T08:30:00Z").getTime(),
        new Date("2024-06-01T09:00:00Z").getTime(),
      ],
      speeds: [2.5, 3.0, 2.8],
    },
  },
};

async function seedTrackImport(
  importData: TrackImport,
  overrides: { sourceId?: string } = {},
) {
  const sourceId = overrides.sourceId ?? importData.properties.sourceId;
  const data = overrides.sourceId
    ? { ...importData, properties: { ...importData.properties, sourceId } }
    : importData;

  await db
    .insert(trackImport)
    .values({
      userId: TEST_USER.id,
      sourceType: data.properties.sourceType,
      sourceId,
      importData: data as unknown as Record<string, unknown>,
    })
    .onConflictDoUpdate({
      target: [
        trackImport.userId,
        trackImport.sourceType,
        trackImport.sourceId,
      ],
      set: { importData: data as unknown as Record<string, unknown> },
    });

  return {
    userId: TEST_USER.id,
    sourceType: data.properties.sourceType,
    sourceId,
  };
}

describe("runImportTrack", () => {
  it("inserts a track with correct fields", async () => {
    const key = await seedTrackImport(BASE_IMPORT);
    const id = await runImportTrack({ key });

    const [row] = await db
      .select({
        sourceType: track.sourceType,
        sourceId: track.sourceId,
      })
      .from(track)
      .where(eq(track.id, id));
    expect(row!.sourceType).toBe("strava");
    expect(row!.sourceId).toBe("123456");

    const trackData = await getTrack(TEST_USER.id, id);
    expect(trackData!.name).toBe("Morning run");
    expect(trackData!.description).toBe("A nice run");
    expect(trackData!.startTime).toBe(BASE_IMPORT.properties.startTime);
    expect(trackData!.endTime).toBe(BASE_IMPORT.properties.endTime);
    expect(trackData!.distanceM).toBeGreaterThan(0);
    expect(trackData!.pointTimestamps).toEqual(
      BASE_IMPORT.properties.coordinateProperties.times,
    );
    expect(trackData!.pointSpeed).toEqual(
      BASE_IMPORT.properties.coordinateProperties.speeds,
    );
  });

  it("sets trackId on track_import row after insert", async () => {
    const key = await seedTrackImport(BASE_IMPORT, {
      sourceId: "set-track-id",
    });
    const id = await runImportTrack({ key });

    const [row] = await db
      .select({ trackId: trackImport.trackId })
      .from(trackImport)
      .where(eq(trackImport.userId, TEST_USER.id));
    expect(row!.trackId).toBe(id);
  });

  it("skips if trackId already set (idempotent)", async () => {
    const key = await seedTrackImport(BASE_IMPORT, {
      sourceId: "already-done",
    });
    const id1 = await runImportTrack({ key });
    const id2 = await runImportTrack({ key });
    expect(id2).toBe(id1);
  });

  it("upserts on re-import and resets populated fields", async () => {
    const key = await seedTrackImport(BASE_IMPORT);
    const id = await runImportTrack({ key });

    const updated: TrackImport = {
      ...BASE_IMPORT,
      properties: { ...BASE_IMPORT.properties, name: "Updated run" },
    };

    const key2 = await seedTrackImport(updated);
    const updatedId = await runImportTrack({
      key: key2,
      options: { force: true },
    });
    expect(updatedId).toBe(id);

    const trackData = await getTrack(TEST_USER.id, id);
    expect(trackData!.name).toBe("Updated run");

    const [row] = await db
      .select({
        pointDemElevation: track.pointDemElevation,
        previewLargeSrc: track.previewLargeSrc,
      })
      .from(track)
      .where(eq(track.id, id));
    expect(row!.pointDemElevation).toBeNull();
    expect(row!.previewLargeSrc).toBeNull();
  });

  it("enqueues dem elevation and preview jobs", async () => {
    const key = await seedTrackImport(BASE_IMPORT, { sourceId: "dem-preview" });
    await runImportTrack({ key });
    expect(await getEnqueuedJobs("track.populateDemElevation")).toHaveLength(1);
    expect(await getEnqueuedJobs("track.populatePreviewImages")).toHaveLength(
      1,
    );
  });

  it("enqueues image.import jobs for photos", async () => {
    const withPhotos: TrackImport = {
      ...BASE_IMPORT,
      properties: {
        ...BASE_IMPORT.properties,
        sourceId: "with-photos",
        photos: [
          {
            url: "https://example.com/photo1.jpg",
            filename: "photo1.jpg",
            taken_at: "2024-06-01T08:10:00",
          },
          { url: "https://example.com/photo2.jpg", filename: "photo2.jpg" },
        ],
      },
    };
    const key = await seedTrackImport(withPhotos, { sourceId: "with-photos" });
    await runImportTrack({ key });

    const jobs = await getEnqueuedJobs("image.import");
    expect(jobs).toHaveLength(2);
    expect(jobs[0]).toMatchObject({
      userId: TEST_USER.id,
      url: "https://example.com/photo1.jpg",
      filename: "photo1.jpg",
      takenAt: "2024-06-01T08:10:00",
    });
    expect(jobs[1]).toMatchObject({
      userId: TEST_USER.id,
      url: "https://example.com/photo2.jpg",
      filename: "photo2.jpg",
    });
    expect(jobs[0]!.linkedTrackId).toBeTruthy();
    expect(jobs[1]!.linkedTrackId).toBe(jobs[0]!.linkedTrackId);
  });

  it("handles missing optional fields", async () => {
    const minimal: TrackImport = {
      type: "Feature",
      geometry: {
        type: "LineString",
        coordinates: [
          [-0.1, 51.5],
          [-0.08, 51.52],
        ],
      },
      properties: {
        sourceType: "strava",
        sourceId: "minimal",
        coordinateProperties: {},
      },
    };
    const key = await seedTrackImport(minimal, { sourceId: "minimal" });
    const id = await runImportTrack({ key });

    const trackData = await getTrack(TEST_USER.id, id);
    expect(trackData!.name).toBeUndefined();
    expect(trackData!.startTime).toBeUndefined();
    expect(trackData!.endTime).toBeUndefined();
  });
});

it("importTrack enqueues a track.import job", async () => {
  const key = {
    userId: TEST_USER.id,
    sourceType: "strava",
    sourceId: "enqueue-test",
  };
  await db.insert(trackImport).values(key);
  await importTrack(key, BASE_IMPORT);
  const jobs = await getEnqueuedJobs("track.import");
  expect(jobs).toHaveLength(1);
  expect(jobs[0]).toMatchObject({ key, options: {} });
});

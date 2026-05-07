import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import db from "../db.js";
import { getEnqueuedJobs } from "../test/helpers.js";
import { TEST_USER } from "../test/setup-db.js";
import { type TrackImport, importTrack, runImportTrack } from "./imports.js";
import { recordedTrack } from "./track.schema.js";
import { getRecordedTrack } from "./track.service.js";

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

describe("runImportTrack", () => {
  it("inserts a track with correct fields", async () => {
    const id = await runImportTrack({
      userId: TEST_USER.id,
      trackImport: BASE_IMPORT,
    });

    const [row] = await db
      .select({
        sourceType: recordedTrack.sourceType,
        sourceId: recordedTrack.sourceId,
      })
      .from(recordedTrack)
      .where(eq(recordedTrack.id, id));
    expect(row!.sourceType).toBe("strava");
    expect(row!.sourceId).toBe("123456");

    const track = await getRecordedTrack(TEST_USER.id, id);
    expect(track!.name).toBe("Morning run");
    expect(track!.description).toBe("A nice run");
    expect(track!.startTime).toBe(BASE_IMPORT.properties.startTime);
    expect(track!.endTime).toBe(BASE_IMPORT.properties.endTime);
    expect(track!.distanceM).toBeGreaterThan(0);
    expect(track!.pointTimestamps).toEqual(
      BASE_IMPORT.properties.coordinateProperties.times,
    );
    expect(track!.pointSpeed).toEqual(
      BASE_IMPORT.properties.coordinateProperties.speeds,
    );
  });

  it("upserts on re-import and resets populated fields", async () => {
    const id = await runImportTrack({
      userId: TEST_USER.id,
      trackImport: BASE_IMPORT,
    });
    const updated: TrackImport = {
      ...BASE_IMPORT,
      properties: { ...BASE_IMPORT.properties, name: "Updated run" },
    };
    const updatedId = await runImportTrack({
      userId: TEST_USER.id,
      trackImport: updated,
    });

    expect(updatedId).toBe(id);

    const track = await getRecordedTrack(TEST_USER.id, id);
    expect(track!.name).toBe("Updated run");

    const [row] = await db
      .select({
        pointDemElevation: recordedTrack.pointDemElevation,
        previewLargeSrc: recordedTrack.previewLargeSrc,
      })
      .from(recordedTrack)
      .where(eq(recordedTrack.id, id));
    expect(row!.pointDemElevation).toBeNull();
    expect(row!.previewLargeSrc).toBeNull();
  });

  it("enqueues dem elevation and preview jobs", async () => {
    await runImportTrack({ userId: TEST_USER.id, trackImport: BASE_IMPORT });
    expect(
      await getEnqueuedJobs("recordedTrack.populateDemElevation"),
    ).toHaveLength(1);
    expect(
      await getEnqueuedJobs("recordedTrack.populatePreviewImages"),
    ).toHaveLength(1);
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
    await runImportTrack({ userId: TEST_USER.id, trackImport: withPhotos });

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
    const id = await runImportTrack({
      userId: TEST_USER.id,
      trackImport: minimal,
    });

    const track = await getRecordedTrack(TEST_USER.id, id);
    expect(track!.name).toBeNull();
    expect(track!.startTime).toBeNull();
    expect(track!.endTime).toBeNull();
  });
});

it("importTrack enqueues a track.import job", async () => {
  await importTrack({ userId: TEST_USER.id, trackImport: BASE_IMPORT });
  const jobs = await getEnqueuedJobs("track.import");
  expect(jobs).toHaveLength(1);
  expect(jobs[0]).toMatchObject({ userId: TEST_USER.id });
});

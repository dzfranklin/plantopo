import { describe, expect, it } from "vitest";

import { type LocalRecordedTrack } from "@pt/shared";

import { TEST_USER } from "../test/setupDb.js";
import {
  getRecordedTrack,
  getRecordedTrackWithPointDetail,
  listRecordedTracks,
  uploadedRecordedTrack,
} from "./track.service.js";

const BASE_TRACK: LocalRecordedTrack = {
  id: "00000000-0000-0000-0000-000000000001",
  name: "Morning run",
  startTime: new Date("2024-06-01T08:00:00Z").getTime(),
  endTime: new Date("2024-06-01T09:00:00Z").getTime(),
  status: "SYNCED",
  points: [
    {
      timestamp: new Date("2024-06-01T08:00:00Z").getTime(),
      latitude: 51.5,
      longitude: -0.1,
      elevation: 10,
      horizontalAccuracy: 5,
      verticalAccuracy: 8,
      speed: 2.5,
      speedAccuracy: 0.5,
      bearing: 90,
      bearingAccuracy: 5,
    },
    {
      timestamp: new Date("2024-06-01T08:30:00Z").getTime(),
      latitude: 51.51,
      longitude: -0.09,
      elevation: 15,
      horizontalAccuracy: 4,
      verticalAccuracy: 7,
      speed: 3.0,
      speedAccuracy: 0.4,
      bearing: 95,
      bearingAccuracy: 4,
    },
    {
      timestamp: new Date("2024-06-01T09:00:00Z").getTime(),
      latitude: 51.52,
      longitude: -0.08,
      elevation: 12,
      horizontalAccuracy: 6,
      verticalAccuracy: 9,
      speed: 2.8,
      speedAccuracy: 0.6,
      bearing: 100,
      bearingAccuracy: 6,
    },
  ],
};

const SPARSE_TRACK: LocalRecordedTrack = {
  id: "00000000-0000-0000-0000-000000000002",
  name: null,
  startTime: new Date("2024-06-02T10:00:00Z").getTime(),
  endTime: null,
  status: "RECORDING",
  points: [
    {
      timestamp: new Date("2024-06-02T10:00:00Z").getTime(),
      latitude: 51.5,
      longitude: -0.1,
      elevation: null,
      horizontalAccuracy: null,
      verticalAccuracy: null,
      speed: null,
      speedAccuracy: null,
      bearing: null,
      bearingAccuracy: null,
    },
  ],
};

describe("uploadedRecordedTrack", () => {
  it("is idempotent on re-upload", async () => {
    await uploadedRecordedTrack(TEST_USER.id, BASE_TRACK);
    await uploadedRecordedTrack(TEST_USER.id, BASE_TRACK);
    const list = await listRecordedTracks(TEST_USER.id);
    expect(list).toHaveLength(1);
  });
});

describe("listRecordedTracks", () => {
  it("returns empty list when no tracks", async () => {
    expect(await listRecordedTracks(TEST_USER.id)).toEqual([]);
  });

  it("returns summaries ordered by startTime desc", async () => {
    await uploadedRecordedTrack(TEST_USER.id, BASE_TRACK);
    await uploadedRecordedTrack(TEST_USER.id, SPARSE_TRACK);
    const list = await listRecordedTracks(TEST_USER.id);
    expect(list).toHaveLength(2);
    expect(list[0]!.id).toBe(SPARSE_TRACK.id);
    expect(list[1]!.id).toBe(BASE_TRACK.id);
  });

  it("returns correct summary fields", async () => {
    await uploadedRecordedTrack(TEST_USER.id, BASE_TRACK);
    const [summary] = await listRecordedTracks(TEST_USER.id);
    expect(summary!.id).toBe(BASE_TRACK.id);
    expect(summary!.name).toBe("Morning run");
    expect(summary!.startTime).toBe(BASE_TRACK.startTime);
    expect(summary!.endTime).toBe(BASE_TRACK.endTime);
    expect(summary!.durationMs).toBe(3600_000);
    expect(summary!.distanceM).toBeGreaterThan(0);
    expect(summary!.summaryPolyline).toBeTruthy();
  });

  it("handles track with no endTime", async () => {
    await uploadedRecordedTrack(TEST_USER.id, SPARSE_TRACK);
    const [summary] = await listRecordedTracks(TEST_USER.id);
    expect(summary!.endTime).toBeNull();
    expect(summary!.durationMs).toBeNull();
  });

  it("does not return other users' tracks", async () => {
    await uploadedRecordedTrack(TEST_USER.id, BASE_TRACK);
    expect(await listRecordedTracks("other-user")).toEqual([]);
  });
});

describe("getRecordedTrack", () => {
  it("returns null for unknown track", async () => {
    expect(
      await getRecordedTrack(
        TEST_USER.id,
        "00000000-0000-0000-0000-000000000099",
      ),
    ).toBeNull();
  });

  it("returns null for another user's track", async () => {
    await uploadedRecordedTrack(TEST_USER.id, BASE_TRACK);
    expect(await getRecordedTrack("other-user", BASE_TRACK.id)).toBeNull();
  });

  it("returns full-resolution polyline and point arrays", async () => {
    await uploadedRecordedTrack(TEST_USER.id, BASE_TRACK);
    const track = await getRecordedTrack(TEST_USER.id, BASE_TRACK.id);
    expect(track).not.toBeNull();
    expect(track!.polyline).toBeTruthy();
    expect(track!.pointTimestamps).toHaveLength(3);
    expect(track!.pointTimestamps[0]).toBe(BASE_TRACK.points[0]!.timestamp);
    expect(track!.pointSpeed).toHaveLength(3);
    expect(track!.pointSpeed![0]).toBeCloseTo(2.5);
    expect(track!.pointSpeedAccuracy).toHaveLength(3);
  });

  it("returns null speed arrays when device lacks sensor", async () => {
    await uploadedRecordedTrack(TEST_USER.id, SPARSE_TRACK);
    const track = await getRecordedTrack(TEST_USER.id, SPARSE_TRACK.id);
    expect(track).not.toBeNull();
    expect(track!.pointSpeed).toBeNull();
    expect(track!.pointSpeedAccuracy).toBeNull();
    // single point => no valid LineString
    expect(track!.polyline).toBeNull();
  });
});

describe("getRecordedTrackWithPointDetail", () => {
  it("returns null for unknown track", async () => {
    expect(
      await getRecordedTrackWithPointDetail(
        TEST_USER.id,
        "00000000-0000-0000-0000-000000000099",
      ),
    ).toBeNull();
  });

  it("returns null for another user's track", async () => {
    await uploadedRecordedTrack(TEST_USER.id, BASE_TRACK);
    expect(
      await getRecordedTrackWithPointDetail("other-user", BASE_TRACK.id),
    ).toBeNull();
  });

  it("includes all sensor arrays", async () => {
    await uploadedRecordedTrack(TEST_USER.id, BASE_TRACK);
    const track = await getRecordedTrackWithPointDetail(
      TEST_USER.id,
      BASE_TRACK.id,
    );
    expect(track).not.toBeNull();
    expect(track!.pointGpsElevation).toHaveLength(3);
    expect(track!.pointGpsElevation![0]).toBeCloseTo(10);
    expect(track!.pointHorizontalAccuracy).toHaveLength(3);
    expect(track!.pointVerticalAccuracy).toHaveLength(3);
    expect(track!.pointBearing).toHaveLength(3);
    expect(track!.pointBearingAccuracy).toHaveLength(3);
  });

  it("returns null sensor arrays when device lacks sensors", async () => {
    await uploadedRecordedTrack(TEST_USER.id, SPARSE_TRACK);
    const track = await getRecordedTrackWithPointDetail(
      TEST_USER.id,
      SPARSE_TRACK.id,
    );
    expect(track!.pointGpsElevation).toBeNull();
    expect(track!.pointHorizontalAccuracy).toBeNull();
    expect(track!.pointVerticalAccuracy).toBeNull();
    expect(track!.pointBearing).toBeNull();
    expect(track!.pointBearingAccuracy).toBeNull();
  });

  it("extends RecordedTrack fields", async () => {
    await uploadedRecordedTrack(TEST_USER.id, BASE_TRACK);
    const track = await getRecordedTrackWithPointDetail(
      TEST_USER.id,
      BASE_TRACK.id,
    );
    // Fields from RecordedTrack are present
    expect(track!.polyline).toBeTruthy();
    expect(track!.summaryPolyline).toBeTruthy();
    expect(track!.distanceM).toBeGreaterThan(0);
    expect(track!.pointTimestamps).toHaveLength(3);
    expect(track!.pointSpeed).toHaveLength(3);
  });
});

import { describe, expect, it } from "vitest";

import { type LocalRecordedTrack, decodePolyline } from "@pt/shared";

import db from "../db.js";
import { TEST_USER } from "../test/setupDb.js";
import { recordedTrack } from "./track.schema.js";
import {
  getRecordedTrack,
  getRecordedTrackWithPointDetail,
  listRecordedTracks,
  uploadedRecordedTrack,
} from "./track.service.js";

type UploadInput = Omit<LocalRecordedTrack, "status"> & { endTime: number };

const BASE_TRACK: UploadInput = {
  id: "00000000-0000-0000-0000-000000000001",
  name: "Morning run",
  startTime: new Date("2024-06-01T08:00:00Z").getTime(),
  endTime: new Date("2024-06-01T09:00:00Z").getTime(),
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

const MINIMAL_TRACK: UploadInput = {
  ...BASE_TRACK,
  id: "00000000-0000-0000-0000-000000000002",
  startTime: new Date("2024-06-01T08:10:00Z").getTime(),
  endTime: new Date("2024-06-01T09:10:00Z").getTime(),
  points: BASE_TRACK.points.map(p => ({
    ...p,
    elevation: null,
    horizontalAccuracy: null,
    verticalAccuracy: null,
    speed: null,
    speedAccuracy: null,
    bearing: null,
    bearingAccuracy: null,
  })),
};

describe("uploadedRecordedTrack", () => {
  it("is idempotent on re-upload", async () => {
    await db.delete(recordedTrack);
    await uploadedRecordedTrack(TEST_USER.id, BASE_TRACK);
    await uploadedRecordedTrack(TEST_USER.id, BASE_TRACK);
    const list = await listRecordedTracks(TEST_USER.id);
    expect(list).toHaveLength(1);
  });

  it("accepts real input", async () => {
    // From emulator running <https://github.com/dzfranklin/plantopo-android/commit/36f56ecfab70875ecf24d7b733ff1e0effe83140>
    const input =
      '{"id":"dd5e15d0-c30c-4846-935b-134328027c74","name":null,"startTime":1776935344352,"endTime":1776935351363,"points":[{"timestamp":1776935348691,"latitude":55.8948183,"longitude":-3.2617283,"elevation":0,"horizontalAccuracy":5,"verticalAccuracy":0.5,"speed":0.98773247,"speedAccuracy":0.5,"bearing":207,"bearingAccuracy":30},{"timestamp":1776935349690,"latitude":55.8948116,"longitude":-3.2617363,"elevation":0,"horizontalAccuracy":5,"verticalAccuracy":0.5,"speed":0.98773277,"speedAccuracy":0.5,"bearing":207.00015,"bearingAccuracy":30},{"timestamp":1776935350690,"latitude":55.8948035,"longitude":-3.2617433,"elevation":0,"horizontalAccuracy":5,"verticalAccuracy":0.5,"speed":0.9877347,"speedAccuracy":0.5,"bearing":206.99995,"bearingAccuracy":30}]}';
    await uploadedRecordedTrack(TEST_USER.id, JSON.parse(input));
    const result = await getRecordedTrack(
      TEST_USER.id,
      "dd5e15d0-c30c-4846-935b-134328027c74",
    );
    expect(result).not.toBeNull();
    expect(result!.id).toBe("dd5e15d0-c30c-4846-935b-134328027c74");
    expect(result!.name).toBeNull();
    expect(result!.startTime).toBe(1776935344352);
    expect(result!.endTime).toBe(1776935351363);
    expect(result!.pointTimestamps).toEqual([
      1776935348691, 1776935349690, 1776935350690,
    ]);
    expect(result!.pointSpeed).toEqual([0.98773247, 0.98773277, 0.9877347]);
    expect(result!.pointSpeedAccuracy).toEqual([0.5, 0.5, 0.5]);
    expect(result!.summaryPolyline).toBeTruthy();
    expect(result!.distanceM).toBeGreaterThan(0);
    expect(decodePolyline(result!.polyline!)).toHaveLength(3);
  });
});

describe("listRecordedTracks", () => {
  it("returns empty list when no tracks", async () => {
    await db.delete(recordedTrack);
    expect(await listRecordedTracks(TEST_USER.id)).toEqual([]);
  });

  it("returns summaries ordered by startTime desc", async () => {
    await db.delete(recordedTrack);
    await uploadedRecordedTrack(TEST_USER.id, BASE_TRACK);
    await uploadedRecordedTrack(TEST_USER.id, MINIMAL_TRACK);
    const list = await listRecordedTracks(TEST_USER.id);
    expect(list).toHaveLength(2);
    expect(list[0]!.id).toBe(MINIMAL_TRACK.id);
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
    await uploadedRecordedTrack(TEST_USER.id, MINIMAL_TRACK);
    const track = await getRecordedTrackWithPointDetail(
      TEST_USER.id,
      MINIMAL_TRACK.id,
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

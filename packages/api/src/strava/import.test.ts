import { describe, expect, it } from "vitest";

import { stravaToTrackImport } from "./import.js";
import {
  ActivityPhotosSchema,
  DetailedActivitySchema,
  StreamResponseSchema,
} from "./strava.api.js";

const activity = DetailedActivitySchema.parse(
  (
    await import("./__fixtures__/GET_api_v3_activities_18376823649_1bed0ba3.json")
  ).default.body,
);
const streams = StreamResponseSchema.parse(
  (
    await import("./__fixtures__/GET_api_v3_activities_18376823649_streams_1fed78b5.json")
  ).default.body,
);
const photos = ActivityPhotosSchema.parse(
  (
    await import("./__fixtures__/GET_api_v3_activities_18376823649_photos_42f71860.json")
  ).default.body,
);

describe("stravaToTrackImport", () => {
  it("parses real data", () => {
    const result = stravaToTrackImport(activity, streams, photos);
    expect(result.geometry.coordinates.length).toBeGreaterThan(2);
    expect(result.properties.coordinateProperties.times?.length).toBe(
      result.geometry.coordinates.length,
    );
    expect(result.properties.coordinateProperties.speeds?.length).toBe(
      result.geometry.coordinates.length,
    );
    expect(result.properties.photos?.length).toBeGreaterThan(0);
    expect(result.properties.startTime).toBeLessThan(Date.now());
    expect(result.properties.endTime).toBeLessThan(Date.now());
    expect(
      result.properties.endTime! - result.properties.startTime!,
    ).toBeCloseTo(activity.elapsed_time * 1000, -2);
    expect(result.properties.name).toBe(activity.name);
    expect(result.properties.description).toBe(activity.description);
    expect(result.properties.sourceId).toBe(activity.id.toString());
    expect(result.properties.sourceType).toBe("strava");
  });
});

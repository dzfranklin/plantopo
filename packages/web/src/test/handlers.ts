import type { inferRouterOutputs } from "@trpc/server";
import type { RequestHandler } from "msw";

import type { AppRouter, ImageInfo, RequestUploadResponse } from "@pt/api";

import { type DeepPartial, deepMerge } from "./helpers";
import { trpc } from "./trpc";

type RouterOutputs = inferRouterOutputs<AppRouter>;
type ActivityListPageWithStatus = RouterOutputs["strava"]["listActivities"];

export function makeImageInfo(
  overrides: DeepPartial<ImageInfo> = {},
): ImageInfo {
  const src = {
    src: "https://cdn.example.com/img.jpg",
    width: 800,
    height: 600,
  };
  const base: ImageInfo = {
    id: "default-image-id",
    filename: "photo.jpg",
    takenAt: null,
    createdAt: new Date("2024-01-01T00:00:00Z").getTime(),
    image: src,
    imageSmallSquare: src,
    originalImage: src,
  };
  return deepMerge(base, overrides);
}

export function makeRequestUploadResponse(
  overrides: DeepPartial<RequestUploadResponse> = {},
): RequestUploadResponse {
  const base: RequestUploadResponse = {
    uploadUrl: "https://s3.example.com/default-key",
    s3Key: "default-key",
    preview: null,
  };
  return deepMerge(base, overrides);
}

export function makeActivityListPageWithStatus(
  overrides: Partial<ActivityListPageWithStatus> = {},
): ActivityListPageWithStatus {
  return {
    activities: [],
    nextCursor: null,
    ...overrides,
  };
}

export function makeActivity(
  id: number,
  name: string,
): ActivityListPageWithStatus["activities"][number] {
  return {
    id,
    name,
    manual: false,
    distance: 5000,
    moving_time: 1800,
    elapsed_time: 1900,
    total_elevation_gain: 50,
    sport_type: "Run",
    start_date: "2024-01-01T10:00:00Z",
    start_date_local: "2024-01-01T10:00:00Z",
    timezone: "UTC",
    trainer: false,
    commute: false,
    private: false,
    average_speed: 3,
    start_latlng: null,
    end_latlng: null,
    map: { id: `map${id}`, summary_polyline: null },
    max_speed: 5,
    importStatus: "none" as const,
  };
}

export const DEFAULT_ACTIVITY_PAGE_1 = makeActivityListPageWithStatus({
  activities: [makeActivity(1, "Morning Run"), makeActivity(2, "Evening Jog")],
  nextCursor: "1700000000",
});

export const DEFAULT_ACTIVITY_PAGE_2 = makeActivityListPageWithStatus({
  activities: [makeActivity(3, "Long Run"), makeActivity(4, "Recovery Run")],
  nextCursor: null,
});

export const defaultHandlers: RequestHandler[] = [
  trpc.image.requestUpload(() => makeRequestUploadResponse()),
  trpc.image.confirmUpload(() => makeImageInfo()),
  trpc.strava.listActivities(({ cursor }) =>
    cursor === DEFAULT_ACTIVITY_PAGE_1.nextCursor
      ? DEFAULT_ACTIVITY_PAGE_2
      : DEFAULT_ACTIVITY_PAGE_1,
  ),
];

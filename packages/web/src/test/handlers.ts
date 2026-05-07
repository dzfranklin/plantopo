import type { RequestHandler } from "msw";

import type {
  ActivityListPage,
  ImageInfo,
  RequestUploadResponse,
} from "@pt/api";

import { type DeepPartial, deepMerge } from "./helpers";
import { trpc } from "./trpc";

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

export function makeActivityListPage(
  overrides: Partial<ActivityListPage> = {},
): ActivityListPage {
  return {
    activities: [],
    nextCursor: null,
    ...overrides,
  };
}

export const defaultHandlers: RequestHandler[] = [
  trpc.image.requestUpload(() => makeRequestUploadResponse()),
  trpc.image.confirmUpload(() => makeImageInfo()),
  trpc.strava.listActivities(() => makeActivityListPage()),
];

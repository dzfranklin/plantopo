import z from "zod";

export type { AppRouter } from "./router.js";
export type { ActivityListPage, SummaryActivity } from "./strava/strava.api.js";
export type { auth } from "./auth/auth.js";
export type { GeocodingFeature } from "./geocoder/geocoder.service.js";
export type {
  RequestUploadResponse,
  ImageInfo,
} from "./image/image.service.js";

export const ImageSrcSchema = z.object({
  src: z.url(),
  width: z.number(),
  height: z.number(),
});

export type ImageSrc = z.infer<typeof ImageSrcSchema>;

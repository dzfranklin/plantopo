import { z } from "zod";

const schema = z.object({
  // LOG_LEVEL is read directly in logger.ts
  APP_URL: z.url(),
  DATABASE_URL: z.url(),
  WEB_DIST: z.string().default("packages/web/dist"),
  BETTER_AUTH_SECRET: z.string().min(32),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GITHUB_CLIENT_ID: z.string().optional(),
  GITHUB_CLIENT_SECRET: z.string().optional(),
  STRAVA_CLIENT_ID: z.string().optional(),
  STRAVA_CLIENT_SECRET: z.string().optional(),
  OWNER_EMAIL: z.email().optional(),
  TILE_CACHE_DIR: z.string(),
  SERVER_TILE_KEY: z.string().optional(),
  VALHALLA: z.string().optional(),
  PHOTON: z.string().optional(),
  STATICMAP_TILES_URL: z.string().optional(),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  throw new Error(
    "[api] Invalid environment variables:" +
      JSON.stringify(z.treeifyError(parsed.error)),
  );
}

export const env = parsed.data;

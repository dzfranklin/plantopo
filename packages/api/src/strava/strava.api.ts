import { eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "../db.js";
import { env } from "../env.js";
import { getLog } from "../logger.js";
import { stravaConnection } from "./strava.schema.js";

// -- Zod schemas --

export const StravaAthleteSchema = z.looseObject({
  id: z.number(),
  firstname: z.string(),
  lastname: z.string(),
  profile: z.string(),
});

export type StravaAthlete = z.infer<typeof StravaAthleteSchema>;

export const StravaTokenResponseSchema = z.object({
  access_token: z.string(),
  refresh_token: z.string(),
  expires_at: z.number(),
  athlete: StravaAthleteSchema,
});

const LatLngSchema = z.tuple([z.number(), z.number()]).nullable();

const PolylineMapSchema = z.looseObject({
  id: z.string(),
  summary_polyline: z.string().nullable(),
});

export const SummaryActivitySchema = z.looseObject({
  id: z.number(),
  name: z.string(),
  distance: z.number(),
  moving_time: z.number(),
  elapsed_time: z.number(),
  total_elevation_gain: z.number(),
  sport_type: z.string(),
  start_date: z.string(),
  start_date_local: z.string(),
  timezone: z.string(),
  start_latlng: LatLngSchema,
  end_latlng: LatLngSchema,
  map: PolylineMapSchema,
  trainer: z.boolean(),
  commute: z.boolean(),
  manual: z.boolean(),
  private: z.boolean(),
  average_speed: z.number(),
  max_speed: z.number(),
  elev_high: z.number().optional(),
  elev_low: z.number().optional(),
  average_heartrate: z.number().optional(),
  max_heartrate: z.number().optional(),
  average_watts: z.number().optional(),
  device_watts: z.boolean().optional(),
});

export type SummaryActivity = z.infer<typeof SummaryActivitySchema>;

// -- OAuth helpers --

export const STRAVA_AUTH_URL = "https://www.strava.com/oauth/authorize";
export const STRAVA_SCOPE = "read,activity:read_all,activity:write";

async function refreshAccessToken(
  userId: string,
  refreshToken: string,
): Promise<string> {
  getLog().info({ userId }, "Refreshing Strava access token");
  const response = await fetch("https://www.strava.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: env.STRAVA_CLIENT_ID,
      client_secret: env.STRAVA_CLIENT_SECRET,
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Strava token refresh failed: ${response.status} ${body}`);
  }
  const data = z
    .object({
      access_token: z.string(),
      refresh_token: z.string(),
      expires_at: z.number(),
    })
    .parse(await response.json());

  await db
    .update(stravaConnection)
    .set({
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      accessTokenExpiresAt: new Date(data.expires_at * 1000),
      updatedAt: new Date(),
    })
    .where(eq(stravaConnection.userId, userId));

  getLog().info({ userId }, "Strava access token refreshed");
  return data.access_token;
}

async function getAccessToken(userId: string): Promise<string> {
  const [row] = await db
    .select({
      accessToken: stravaConnection.accessToken,
      refreshToken: stravaConnection.refreshToken,
      accessTokenExpiresAt: stravaConnection.accessTokenExpiresAt,
    })
    .from(stravaConnection)
    .where(eq(stravaConnection.userId, userId))
    .limit(1);

  if (!row) throw new Error(`No Strava connection for user ${userId}`);

  // Refresh if expiring within 5 minutes.
  if (row.accessTokenExpiresAt.getTime() - Date.now() < 5 * 60 * 1000) {
    return refreshAccessToken(userId, row.refreshToken);
  }
  return row.accessToken;
}

// -- API calls --

export async function exchangeCodeForTokens(
  code: string,
): Promise<z.infer<typeof StravaTokenResponseSchema>> {
  getLog().info("Exchanging Strava authorization code for tokens");
  const response = await fetch("https://www.strava.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: env.STRAVA_CLIENT_ID,
      client_secret: env.STRAVA_CLIENT_SECRET,
      code,
      grant_type: "authorization_code",
    }),
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Strava token exchange failed: ${response.status} ${body}`);
  }
  const data = StravaTokenResponseSchema.parse(await response.json());
  getLog().info(
    { athleteId: data.athlete.id },
    "Strava token exchange succeeded",
  );
  return data;
}

export async function revokeToken(accessToken: string): Promise<void> {
  const response = await fetch(
    `https://www.strava.com/oauth/deauthorize?access_token=${encodeURIComponent(accessToken)}`,
    { method: "POST" },
  );
  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `Strava token revocation failed: ${response.status} ${body}`,
    );
  }
}

const DetailedSegmentEffortSchema = z.looseObject({
  id: z.number(),
  activity_id: z.number(),
  elapsed_time: z.number(),
  moving_time: z.number(),
  start_date: z.string(),
  start_date_local: z.string(),
  distance: z.number(),
  name: z.string(),
  start_index: z.number(),
  end_index: z.number(),
  average_cadence: z.number().optional(),
  average_watts: z.number().optional(),
  device_watts: z.boolean().optional(),
  average_heartrate: z.number().optional(),
  max_heartrate: z.number().optional(),
  kom_rank: z.number().nullable().optional(),
  pr_rank: z.number().nullable().optional(),
  hidden: z.boolean().optional(),
});

export const DetailedActivitySchema = SummaryActivitySchema.extend({
  description: z.string().nullable().optional(),
  calories: z.number().optional(),
  device_name: z.string().optional(),
  segment_efforts: z.array(DetailedSegmentEffortSchema).optional(),
  best_efforts: z.array(DetailedSegmentEffortSchema).optional(),
});

export type DetailedActivity = z.infer<typeof DetailedActivitySchema>;

export async function getActivity(
  userId: string,
  activityId: number,
): Promise<DetailedActivity> {
  const accessToken = await getAccessToken(userId);
  getLog().info({ userId, activityId }, "Fetching Strava activity");
  const response = await fetch(
    `https://www.strava.com/api/v3/activities/${activityId}?include_all_efforts=true`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Strava activity fetch failed: ${response.status} ${body}`);
  }
  return DetailedActivitySchema.parse(await response.json());
}

export async function getLoggedInAthleteActivities(
  userId: string,
  params: { before?: number; after?: number; page?: number; per_page?: number },
): Promise<SummaryActivity[]> {
  const accessToken = await getAccessToken(userId);
  const url = new URL("https://www.strava.com/api/v3/athlete/activities");
  if (params.before !== undefined)
    url.searchParams.set("before", String(params.before));
  if (params.after !== undefined)
    url.searchParams.set("after", String(params.after));
  if (params.page !== undefined)
    url.searchParams.set("page", String(params.page));
  if (params.per_page !== undefined)
    url.searchParams.set("per_page", String(params.per_page));

  getLog().info({ userId, params }, "Fetching Strava activities");
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `Strava activities fetch failed: ${response.status} ${body}`,
    );
  }
  const data = z.array(SummaryActivitySchema).parse(await response.json());
  getLog().info({ userId, count: data.length }, "Fetched Strava activities");
  return data;
}

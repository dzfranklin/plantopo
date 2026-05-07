import { eq } from "drizzle-orm";
import { z } from "zod";

import { CircuitBreaker, CircuitOpenError } from "../circuit-breaker.js";
import { db } from "../db.js";
import { env } from "../env.js";
import { getLog } from "../logger.js";
import { stravaConnection } from "./strava.schema.js";

export class StravaApiError extends Error {
  status: number;
  body?: string;
  constructor(status: number, body?: string, cause?: unknown) {
    super(`Strava API error: ${status} ${body ?? ""}`, { cause });
    this.status = status;
    this.body = body;
  }

  static async fromResponse(response: Response): Promise<StravaApiError> {
    let body: string | undefined;
    try {
      body = await response.text();
      if (body.length > 100) body = body.slice(0, 100) + "...";
    } catch {
      body = undefined;
    }
    return new StravaApiError(response.status, body);
  }
}

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

export type StravaTokenResponse = z.infer<typeof StravaTokenResponseSchema>;

const LatLngSchema = z.tuple([z.number(), z.number()]).nullable();

const PolylineMapSchema = z.looseObject({
  id: z.string(),
  summary_polyline: z.string().nullable(),
});

const SummaryActivityBaseSchema = z.looseObject({
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
  trainer: z.boolean(),
  commute: z.boolean(),
  private: z.boolean(),
  average_speed: z.number(),
});

const ManualSummaryActivitySchema = SummaryActivityBaseSchema.extend({
  manual: z.literal(true),
});

const TrackedSummaryActivitySchema = SummaryActivityBaseSchema.extend({
  manual: z.literal(false),
  start_latlng: LatLngSchema,
  end_latlng: LatLngSchema,
  map: PolylineMapSchema,
  max_speed: z.number(),
  elev_high: z.number().optional(),
  elev_low: z.number().optional(),
  average_heartrate: z.number().optional(),
  max_heartrate: z.number().optional(),
  average_watts: z.number().optional(),
  device_watts: z.boolean().optional(),
});

export const SummaryActivitySchema = z.discriminatedUnion("manual", [
  ManualSummaryActivitySchema,
  TrackedSummaryActivitySchema,
]);

export type SummaryActivity = z.infer<typeof SummaryActivitySchema>;

const ActivityPhotoSchema = z.looseObject({
  unique_id: z.string(),
  uploaded_at: z.string(),
  created_at: z.iso.datetime(),
  // Strava appends Z but the value is already local time, not UTC
  created_at_local: z.iso.datetime().transform(s => s.replace(/Z$/, "")),
  urls: z.looseObject({
    "2048": z.url(), // The largest size available
  }),
  sizes: z.looseObject({
    // [width, height] indicating aspect ratio, not actual dimensions
    "2048": z.tuple([z.number(), z.number()]),
  }),
  default_photo: z.boolean(),
});

export type ActivityPhoto = z.infer<typeof ActivityPhotoSchema>;

// -- OAuth helpers --

export const STRAVA_AUTH_URL = "https://www.strava.com/oauth/authorize";
export const STRAVA_SCOPE = "read,activity:read_all,activity:write";

// Trip the circuit open at 95% usage on either window, or on 429.
function shouldTripCircuitBreaker(response: Response): boolean {
  if (response.status === 429) return true;
  for (const [usageHeader, limitHeader] of [
    ["x-ratelimit-usage", "x-ratelimit-limit"],
    ["x-readratelimit-usage", "x-readratelimit-limit"],
  ] as const) {
    const usage = response.headers.get(usageHeader);
    const limit = response.headers.get(limitHeader);
    if (!usage || !limit) continue;
    const usageParts = usage.split(",").map(Number);
    const limitParts = limit.split(",").map(Number);
    for (let i = 0; i < usageParts.length; i++) {
      const u = usageParts[i]!;
      const l = limitParts[i];
      if (l && u / l >= 0.95) return true;
    }
  }
  return false;
}

const stravaCircuitBreaker = new CircuitBreaker(
  "strava",
  shouldTripCircuitBreaker,
  { baseDelayMs: 10_000, maxDelayMs: 1000 * 60 * 60 },
);

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

const detailedActivityExtra = {
  description: z.string().nullable().optional(),
  calories: z.number().optional(),
  device_name: z.string().optional(),
  segment_efforts: z.array(DetailedSegmentEffortSchema).optional(),
  best_efforts: z.array(DetailedSegmentEffortSchema).optional(),
};

export const DetailedActivitySchema = z.discriminatedUnion("manual", [
  ManualSummaryActivitySchema.extend(detailedActivityExtra),
  TrackedSummaryActivitySchema.extend(detailedActivityExtra),
]);

export type DetailedActivity = z.infer<typeof DetailedActivitySchema>;

export const ListActivitiesInputSchema = z.object({
  before: z.int().optional(),
  after: z.int().optional(),
  page: z.int().min(1).optional(),
  perPage: z.int().min(1).optional(),
});

// -- Token store --

export interface TokenStore {
  getTokens(userId: string): Promise<{
    accessToken: string;
    refreshToken: string;
    accessTokenExpiresAt: Date;
  } | null>;
  updateTokens(
    userId: string,
    tokens: {
      accessToken: string;
      refreshToken: string;
      accessTokenExpiresAt: Date;
    },
  ): Promise<void>;
}

export const dbTokenStore: TokenStore = {
  async getTokens(userId) {
    const [row] = await db
      .select({
        accessToken: stravaConnection.accessToken,
        refreshToken: stravaConnection.refreshToken,
        accessTokenExpiresAt: stravaConnection.accessTokenExpiresAt,
      })
      .from(stravaConnection)
      .where(eq(stravaConnection.userId, userId))
      .limit(1);
    return row ?? null;
  },

  async updateTokens(userId, tokens) {
    await db
      .update(stravaConnection)
      .set({
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        accessTokenExpiresAt: tokens.accessTokenExpiresAt,
        updatedAt: new Date(),
      })
      .where(eq(stravaConnection.userId, userId));
  },
};

export class StravaApi {
  private tokenStore: TokenStore;

  constructor(tokenStore: TokenStore) {
    this.tokenStore = tokenStore;
  }

  private static async stravaFetch(
    input: string | URL | Request,
    init?: RequestInit,
  ): Promise<Response> {
    let response: Response;
    try {
      response = await stravaCircuitBreaker.fetch(input, init);
    } catch (err) {
      if (err instanceof CircuitOpenError) {
        throw new StravaApiError(429, "Circuit breaker open", err);
      }
      throw err;
    }
    if (!response.ok) throw await StravaApiError.fromResponse(response);
    return response;
  }

  static async exchangeCodeForTokens(
    code: string,
  ): Promise<z.infer<typeof StravaTokenResponseSchema>> {
    getLog().info("Exchanging Strava authorization code for tokens");
    const response = await StravaApi.stravaFetch(
      "https://www.strava.com/oauth/token",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: env.STRAVA_CLIENT_ID,
          client_secret: env.STRAVA_CLIENT_SECRET,
          code,
          grant_type: "authorization_code",
        }),
      },
    );

    const data = StravaTokenResponseSchema.parse(await response.json());
    getLog().info(
      { athleteId: data.athlete.id },
      "Strava token exchange succeeded",
    );
    return data;
  }

  static async revokeToken(accessToken: string): Promise<void> {
    await StravaApi.stravaFetch(
      `https://www.strava.com/oauth/deauthorize?access_token=${encodeURIComponent(accessToken)}`,
      { method: "POST" },
    );
  }

  async refreshAccessToken(
    userId: string,
    refreshToken?: string,
  ): Promise<string> {
    getLog().info({ userId }, "Refreshing Strava access token");

    refreshToken ??= (await this.tokenStore.getTokens(userId))?.refreshToken;
    if (!refreshToken) {
      throw new Error(`No refresh token available for user ${userId}`);
    }

    const response = await StravaApi.stravaFetch(
      "https://www.strava.com/oauth/token",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: env.STRAVA_CLIENT_ID,
          client_secret: env.STRAVA_CLIENT_SECRET,
          grant_type: "refresh_token",
          refresh_token: refreshToken,
        }),
      },
    );

    const data = z
      .object({
        access_token: z.string(),
        refresh_token: z.string(),
        expires_at: z.number(),
      })
      .parse(await response.json());

    await this.tokenStore.updateTokens(userId, {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      accessTokenExpiresAt: new Date(data.expires_at * 1000),
    });

    getLog().info({ userId }, "Strava access token refreshed");
    return data.access_token;
  }

  private async getAccessToken(appUserId: string): Promise<string> {
    const row = await this.tokenStore.getTokens(appUserId);
    if (!row) throw new Error(`No Strava connection for user ${appUserId}`);

    // Refresh if expiring within 5 minutes.
    if (row.accessTokenExpiresAt.getTime() - Date.now() < 5 * 60 * 1000) {
      return this.refreshAccessToken(appUserId, row.refreshToken);
    }
    return row.accessToken;
  }

  async getActivity(
    appUserId: string,
    activityId: number,
  ): Promise<DetailedActivity> {
    const accessToken = await this.getAccessToken(appUserId);
    getLog().info(
      { userId: appUserId, activityId },
      "Fetching Strava activity",
    );
    const response = await StravaApi.stravaFetch(
      `https://www.strava.com/api/v3/activities/${activityId}?include_all_efforts=true`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    return DetailedActivitySchema.parse(await response.json());
  }

  async listActivities(
    appUserId: string,
    params: z.infer<typeof ListActivitiesInputSchema>,
  ): Promise<SummaryActivity[]> {
    const accessToken = await this.getAccessToken(appUserId);
    const url = new URL("https://www.strava.com/api/v3/athlete/activities");
    if (params.before !== undefined)
      url.searchParams.set("before", String(params.before));
    if (params.after !== undefined)
      url.searchParams.set("after", String(params.after));
    if (params.page !== undefined)
      url.searchParams.set("page", String(params.page));
    if (params.perPage !== undefined)
      url.searchParams.set("per_page", String(params.perPage));

    getLog().info({ userId: appUserId, params }, "Fetching Strava activities");
    const response = await StravaApi.stravaFetch(url.toString(), {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const rawData = await response.json();
    const data = z.array(SummaryActivitySchema).parse(rawData);
    getLog().info(
      { userId: appUserId, count: data.length },
      "Fetched Strava activities",
    );
    return data;
  }

  async getActivityPhotos(
    appUserId: string,
    activityId: number,
  ): Promise<ActivityPhoto[]> {
    // See <https://communityhub.strava.com/developers-api-7/download-all-photos-of-my-own-activities-3061>
    const accessToken = await this.getAccessToken(appUserId);
    const url = `https://www.strava.com/api/v3/activities/${activityId}/photos?size=2048`;
    getLog().info(
      { userId: appUserId, activityId },
      "Fetching Strava activity photos",
    );
    const response = await StravaApi.stravaFetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const rawData = await response.json();
    return z.array(ActivityPhotoSchema).parse(rawData);
  }
}

export const stravaApi = new StravaApi(dbTokenStore);

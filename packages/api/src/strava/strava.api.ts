import { eq } from "drizzle-orm";
import { Redis } from "ioredis";
import { Gauge } from "prom-client";
import { z } from "zod";

import { CircuitBreaker, CircuitOpenError } from "../circuit-breaker.js";
import { db } from "../db.js";
import { env } from "../env.js";
import { getLog } from "../logger.js";
import { registry } from "../metrics-registry.js";
import { stravaConnection } from "./strava.schema.js";

export interface Cache {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, opts: { ex: number }): Promise<void>;
}

export class StravaApiError extends Error {
  status: number;
  body?: string;
  constructor(status: number, body?: string, cause?: unknown) {
    super(`Strava API error: ${status} ${body ?? ""}`, { cause });
    this.name = "StravaApiError";
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

export const ActivityPhotosSchema = z.array(ActivityPhotoSchema);

export type ActivityPhotos = z.infer<typeof ActivityPhotosSchema>;

const StreamBaseSchema = z.looseObject({
  original_size: z.number(),
  resolution: z.enum(["low", "medium", "high"]),
  series_type: z.enum(["distance", "time"]),
});

const TimeStreamSchema = StreamBaseSchema.extend({
  data: z.array(z.int()), // in seconds
});
const DistanceStreamSchema = StreamBaseSchema.extend({
  data: z.array(z.number()), // in meters
});
const LatLngStreamSchema = StreamBaseSchema.extend({
  data: z.array(z.tuple([z.number(), z.number()])), // [lat, lng]
});
const AltitudeStreamSchema = StreamBaseSchema.extend({
  data: z.array(z.number()), // in meters
});
const SmoothVelocityStreamSchema = StreamBaseSchema.extend({
  data: z.array(z.number()), // in m/s
});
const MovingStreamSchema = StreamBaseSchema.extend({
  data: z.array(z.boolean()),
});
const SmoothGradeStreamSchema = StreamBaseSchema.extend({
  data: z.array(z.number()), // in percent
});
const HeartrateStreamSchema = StreamBaseSchema.extend({
  data: z.array(z.number()), // in bpm
});
const CadenceStreamSchema = StreamBaseSchema.extend({
  data: z.array(z.number()), // in rpm
});
const PowerStreamSchema = StreamBaseSchema.extend({
  data: z.array(z.number()), // in watts
});
const TemperatureStreamSchema = StreamBaseSchema.extend({
  data: z.array(z.number()), // in celsius
});

export const StreamResponseSchema = z.object({
  time: TimeStreamSchema.optional(),
  distance: DistanceStreamSchema.optional(),
  latlng: LatLngStreamSchema.optional(),
  altitude: AltitudeStreamSchema.optional(),
  velocity_smooth: SmoothVelocityStreamSchema.optional(),
  moving: MovingStreamSchema.optional(),
  grade_smooth: SmoothGradeStreamSchema.optional(),
  heartrate: HeartrateStreamSchema.optional(),
  cadence: CadenceStreamSchema.optional(),
  watts: PowerStreamSchema.optional(),
  temp: TemperatureStreamSchema.optional(),
});

export type StreamResponse = z.infer<typeof StreamResponseSchema>;

export type StreamType = keyof StreamResponse;

// -- OAuth helpers --

export const STRAVA_AUTH_URL = "https://www.strava.com/oauth/authorize";
export const STRAVA_SCOPE = "read,activity:read_all,activity:write";

const rateLimitGauge = new Gauge({
  name: "strava_api_rate_limit",
  help: "Strava API rate limit and usage",
  labelNames: ["window", "type", "metric"] as const,
  registers: [registry],
});

// Trip the circuit open at 95% usage on either window, or on 429.
function shouldTripCircuitBreaker(response: Response): boolean {
  if (response.status === 429) return true;
  const headers = parseHeaders(response.headers);
  if (!headers) return false;
  const { ratelimit, readratelimit } = headers;

  for (const [window, type, limit, usage] of [
    ["15min", "overall", ratelimit.limit[0], ratelimit.usage[0]],
    ["day", "overall", ratelimit.limit[1], ratelimit.usage[1]],
    ["15min", "read", readratelimit.limit[0], readratelimit.usage[0]],
    ["day", "read", readratelimit.limit[1], readratelimit.usage[1]],
  ] as const) {
    rateLimitGauge.set({ window, type, metric: "limit" }, limit);
    rateLimitGauge.set({ window, type, metric: "usage" }, usage);
  }

  const usagePercents = [
    ratelimit.usage[0] / ratelimit.limit[0],
    ratelimit.usage[1] / ratelimit.limit[1],
    readratelimit.usage[0] / readratelimit.limit[0],
    readratelimit.usage[1] / readratelimit.limit[1],
  ];
  const maxUsage = Math.max(...usagePercents);
  return maxUsage >= 0.95;
}

export const stravaCircuitBreaker = new CircuitBreaker(
  "strava",
  shouldTripCircuitBreaker,
  { baseDelayMs: 10_000, maxDelayMs: 1000 * 60 * 60 },
);

const DetailedSegmentEffortSchema = z.looseObject({
  id: z.number(),
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
  perPage: z.int().min(1).max(200).optional(),
});

const ActivitiesCacheEntrySchema = z.object({
  activities: z.array(SummaryActivitySchema),
  fetchedAt: z.number(),
});

export const ActivityListPageSchema = z.object({
  activities: z.array(SummaryActivitySchema),
  nextCursor: z.string().nullable(),
});

export type ActivityListPage = z.infer<typeof ActivityListPageSchema>;

const ACTIVITIES_PAGE_SIZE = 200;
const LATEST_PAGE_FRESH_MS = 5 * 60 * 1000;
const OLDER_PAGE_FRESH_MS = 24 * 60 * 60 * 1000;
const CACHE_TTL_S = 7 * 24 * 60 * 60;

export class StravaApi {
  private tokenStore: TokenStore;
  private cache: Cache;

  constructor(tokenStore: TokenStore, cache: Cache) {
    this.tokenStore = tokenStore;
    this.cache = cache;
  }

  private static async stravaFetch(
    input: string | URL | Request,
    init?: RequestInit,
  ): Promise<Response> {
    let response: Response;
    try {
      response = await stravaCircuitBreaker.fetch(input.toString(), init);
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

  async listActivitiesUncached(
    appUserId: string,
    params: z.infer<typeof ListActivitiesInputSchema>,
  ): Promise<SummaryActivity[]> {
    const accessToken = await this.getAccessToken(appUserId);
    const url = new URL("https://www.strava.com/api/v3/athlete/activities");
    if (params.before !== undefined)
      url.searchParams.set("before", String(params.before));
    if (params.after !== undefined)
      url.searchParams.set("after", String(params.after));
    if (params.perPage !== undefined)
      url.searchParams.set("per_page", String(params.perPage));

    getLog().info({ userId: appUserId, params }, "Fetching Strava activities");
    const response = await StravaApi.stravaFetch(url, {
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

  async listActivitiesPage(
    appUserId: string,
    cursor?: string,
  ): Promise<ActivityListPage> {
    const before = cursor ? parseInt(cursor, 10) : 0;
    const cacheKey = `strava:activities:v1:${appUserId}:${before}`;
    const freshMs = before === 0 ? LATEST_PAGE_FRESH_MS : OLDER_PAGE_FRESH_MS;

    const cached = await this.cache.get(cacheKey);
    const cachedEntry = cached
      ? ActivitiesCacheEntrySchema.parse(JSON.parse(cached))
      : null;

    if (cachedEntry && Date.now() - cachedEntry.fetchedAt < freshMs) {
      getLog().info(
        {
          userId: appUserId,
          before,
          cacheAgeMs: Date.now() - cachedEntry.fetchedAt,
        },
        "Returning cached Strava activities",
      );
      return toPage(cachedEntry.activities);
    }

    let activities: SummaryActivity[];
    try {
      activities = await this.listActivitiesUncached(appUserId, {
        before: before || undefined,
        perPage: ACTIVITIES_PAGE_SIZE,
      });
    } catch (err) {
      if (cachedEntry) {
        getLog().warn(
          { err, userId: appUserId },
          "Strava fetch failed, returning stale activities cache",
        );
        return toPage(cachedEntry.activities);
      }
      throw err;
    }

    await this.cache.set(
      cacheKey,
      JSON.stringify({ activities, fetchedAt: Date.now() }),
      { ex: CACHE_TTL_S },
    );
    return toPage(activities);
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

  async getActivityStreams(
    appUserId: string,
    activityId: number,
    types: StreamType[],
  ): Promise<StreamResponse> {
    const accessToken = await this.getAccessToken(appUserId);

    const url = new URL(
      `https://www.strava.com/api/v3/activities/${activityId}/streams`,
    );
    url.searchParams.set("keys", types.join(","));
    url.searchParams.set("key_by_type", "true");
    url.searchParams.set("resolution", "high"); // deprecated, may have no effect

    getLog().info(
      { userId: appUserId, activityId, types },
      "Fetching Strava activity streams",
    );
    const response = await StravaApi.stravaFetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const rawData = await response.json();
    return StreamResponseSchema.parse(rawData);
  }
}

function toPage(activities: SummaryActivity[]): ActivityListPage {
  const nextCursor =
    activities.length === ACTIVITIES_PAGE_SIZE
      ? String(
          Math.floor(new Date(activities.at(-1)!.start_date).getTime() / 1000),
        )
      : null;
  return { activities, nextCursor };
}

interface RateLimitStatus {
  limit: [number, number]; // [15min, day]
  usage: [number, number]; // [15min, day]
}

interface StravaHeaders {
  ratelimit: RateLimitStatus;
  readratelimit: RateLimitStatus;
}

function parseHeaders(headers: Headers): StravaHeaders | null {
  // eg "x-ratelimit-limit": "200,2000"
  const parseRateLimit = (
    usageHeader: string,
    limitHeader: string,
  ): RateLimitStatus | undefined => {
    const usage = headers.get(usageHeader);
    const limit = headers.get(limitHeader);
    if (!usage || !limit) return undefined;
    const usageParts = usage.split(",").map(Number);
    const limitParts = limit.split(",").map(Number);
    if (usageParts.length !== 2 || limitParts.length !== 2) return undefined;
    return {
      usage: [usageParts[0]!, usageParts[1]!],
      limit: [limitParts[0]!, limitParts[1]!],
    };
  };
  const ratelimit = parseRateLimit("x-ratelimit-usage", "x-ratelimit-limit");
  const readratelimit = parseRateLimit(
    "x-readratelimit-usage",
    "x-readratelimit-limit",
  );
  if (!ratelimit || !readratelimit) {
    getLog().warn({ headers }, "Missing Strava rate limit headers");
    return null;
  }
  return { ratelimit, readratelimit };
}

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

class RedisCache implements Cache {
  private redis: Redis;

  constructor(redis: Redis) {
    this.redis = redis;
  }

  async get(key: string): Promise<string | null> {
    return this.redis.get(key);
  }

  async set(key: string, value: string, opts: { ex: number }): Promise<void> {
    await this.redis.set(key, value, "EX", opts.ex);
  }
}

const redis = new Redis(env.REDIS_URL);
redis.on("error", (err: unknown) => {
  getLog().error({ err }, "Strava Redis connection error");
});

export const stravaApi = new StravaApi(dbTokenStore, new RedisCache(redis));

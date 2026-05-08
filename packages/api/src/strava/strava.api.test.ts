import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ClientError } from "../errors.js";
import { makeFixtureFetch } from "../test/fixture-fetch.js";
import {
  type Cache,
  StravaApi,
  type TokenStore,
  stravaCircuitBreaker,
} from "./strava.api.js";

const fixturesDir = join(import.meta.dirname, "__fixtures__");

const FUTURE = new Date(Date.now() + 60 * 60 * 1000);

if (process.env.RECORD_FIXTURES) {
  if (!process.env.STRAVA_TEST_FIXTURE_ACCESS_TOKEN) {
    if (process.env.STRAVA_TEST_FIXTURE_REFRESH_TOKEN) {
      const client = new StravaApi(
        {
          getTokens: async () => ({
            refreshToken: process.env.STRAVA_TEST_FIXTURE_REFRESH_TOKEN!,
            accessToken: "",
            accessTokenExpiresAt: new Date(0),
          }),
          updateTokens: async (_userId, tokens) => {
            console.log("Update .env.test.local with:");
            console.log(
              "STRAVA_TEST_FIXTURE_ACCESS_TOKEN=" + tokens.accessToken,
            );
            process.exit(1);
          },
        },
        makeNullCache(),
      );
      await client.refreshAccessToken("ignored");
      throw new Error("Expected process exit");
    } else {
      throw new Error(
        "To record Strava API fixtures, set STRAVA_TEST_FIXTURE_REFRESH_TOKEN to a valid refresh token",
      );
    }
  }
}

function makeTokenStore(overrides?: Partial<TokenStore>): TokenStore {
  return {
    getTokens: vi.fn().mockResolvedValue({
      accessToken: process.env.RECORD_FIXTURES
        ? process.env.STRAVA_TEST_FIXTURE_ACCESS_TOKEN
        : "test-access-token",
      refreshToken: process.env.RECORD_FIXTURES
        ? process.env.STRAVA_TEST_FIXTURE_REFRESH_TOKEN
        : "test-refresh-token",
      accessTokenExpiresAt: FUTURE,
    }),
    updateTokens: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

function makeNullCache(): Cache {
  return {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue(undefined),
  };
}

function makeMapCache(): Cache & { store: Map<string, string> } {
  const store = new Map<string, string>();
  return {
    store,
    get: vi.fn(async (key: string) => store.get(key) ?? null),
    set: vi.fn(async (key: string, value: string) => {
      store.set(key, value);
    }),
  };
}

describe("StravaApi", () => {
  let fixtureFetch: typeof fetch;

  beforeEach(() => {
    fixtureFetch = makeFixtureFetch(fixturesDir);
    vi.stubGlobal("fetch", fixtureFetch);
  });

  afterEach(() => {
    stravaCircuitBreaker.reset();
  });

  describe("getActivity", () => {
    it("fetches and parses a tracked activity", async () => {
      const api = new StravaApi(makeTokenStore(), makeNullCache());
      const activity = await api.getActivity("user-1", 18376823649);
      expect(activity.id).toBeTypeOf("number");
      expect(activity.name).toBeTypeOf("string");
      expect(activity.manual).toBe(false);
    });

    it("throws StravaApiError on non-ok response", async () => {
      vi.stubGlobal(
        "fetch",
        async () => new Response("Unauthorized", { status: 401 }),
      );
      const api = new StravaApi(makeTokenStore(), makeNullCache());
      await expect(api.getActivity("user-1", 999)).rejects.toMatchObject({
        status: 401,
      });
    });
  });

  describe("listActivitiesUncached", () => {
    it("fetches and parses a list of activities", async () => {
      const api = new StravaApi(makeTokenStore(), makeNullCache());
      const activities = await api.listActivitiesUncached("user-1", {
        perPage: 10,
      });
      expect(activities.length).toBeGreaterThan(0);
      expect(activities[0]!.id).toBeTypeOf("number");
    });

    it("max perPage", async () => {
      const api = new StravaApi(makeTokenStore(), makeNullCache());
      const activities = await api.listActivitiesUncached("user-1", {
        perPage: 200,
      });
      expect(activities.length).toBeGreaterThan(0);
    });

    it("throws StravaApiError on non-ok response", async () => {
      vi.stubGlobal(
        "fetch",
        async () => new Response("Forbidden", { status: 403 }),
      );
      const api = new StravaApi(makeTokenStore(), makeNullCache());
      await expect(
        api.listActivitiesUncached("user-1", {}),
      ).rejects.toMatchObject({
        status: 403,
      });
    });
  });

  describe("listActivitiesPage", () => {
    it("fetches and returns activities with nextCursor when full page", async () => {
      const mockActivities = Array.from({ length: 200 }, (_, i) => ({
        id: i,
        name: `Activity ${i}`,
        manual: false,
        distance: 1000,
        moving_time: 3600,
        elapsed_time: 3600,
        total_elevation_gain: 100,
        sport_type: "Run",
        start_date: new Date(1_700_000_000_000 - i * 86_400_000).toISOString(),
        start_date_local: new Date(
          1_700_000_000_000 - i * 86_400_000,
        ).toISOString(),
        timezone: "UTC",
        trainer: false,
        commute: false,
        private: false,
        average_speed: 3,
        start_latlng: null,
        end_latlng: null,
        map: { id: `a${i}`, summary_polyline: null },
        max_speed: 5,
      }));

      vi.stubGlobal(
        "fetch",
        vi
          .fn()
          .mockResolvedValue(
            new Response(JSON.stringify(mockActivities), { status: 200 }),
          ),
      );

      const cache = makeMapCache();
      const api = new StravaApi(makeTokenStore(), cache);
      const result = await api.listActivitiesPage("user-1");

      expect(result.activities).toHaveLength(200);
      expect(result.nextCursor).toBeTypeOf("string");
      expect(cache.set).toHaveBeenCalled();
    });

    it("returns nextCursor null when page is not full", async () => {
      vi.stubGlobal(
        "fetch",
        vi
          .fn()
          .mockResolvedValue(new Response(JSON.stringify([]), { status: 200 })),
      );

      const api = new StravaApi(makeTokenStore(), makeMapCache());
      const result = await api.listActivitiesPage("user-1");

      expect(result.activities).toHaveLength(0);
      expect(result.nextCursor).toBeNull();
    });

    it("returns cached result when fresh (before=0, within 5 min)", async () => {
      const fetchSpy = vi.fn();
      vi.stubGlobal("fetch", fetchSpy);

      const cache = makeMapCache();
      cache.store.set(
        "strava:activities:v1:user-1:0",
        JSON.stringify({ activities: [], fetchedAt: Date.now() }),
      );

      const api = new StravaApi(makeTokenStore(), cache);
      await api.listActivitiesPage("user-1");

      expect(fetchSpy).not.toHaveBeenCalledWith(
        expect.stringContaining("athlete/activities"),
        expect.anything(),
      );
    });

    it("fetches when cache is stale (before=0, older than 5 min)", async () => {
      vi.stubGlobal(
        "fetch",
        vi
          .fn()
          .mockResolvedValue(new Response(JSON.stringify([]), { status: 200 })),
      );

      const cache = makeMapCache();
      cache.store.set(
        "strava:activities:v1:user-1:0",
        JSON.stringify({
          activities: [],
          fetchedAt: Date.now() - 6 * 60 * 1000,
        }),
      );

      const api = new StravaApi(makeTokenStore(), cache);
      await api.listActivitiesPage("user-1");

      expect(cache.set).toHaveBeenCalled();
    });

    it("returns cached result when fresh (before>0, within 24 hr)", async () => {
      const fetchSpy = vi.fn();
      vi.stubGlobal("fetch", fetchSpy);

      const before = 1_700_000_000;
      const cache = makeMapCache();
      cache.store.set(
        `strava:activities:v1:user-1:${before}`,
        JSON.stringify({
          activities: [],
          fetchedAt: Date.now() - 60 * 60 * 1000,
        }),
      );

      const api = new StravaApi(makeTokenStore(), cache);
      await api.listActivitiesPage("user-1", String(before));

      expect(fetchSpy).not.toHaveBeenCalledWith(
        expect.stringContaining("athlete/activities"),
        expect.anything(),
      );
    });

    it("fetches when cache is stale (before>0, older than 24 hr)", async () => {
      vi.stubGlobal(
        "fetch",
        vi
          .fn()
          .mockResolvedValue(new Response(JSON.stringify([]), { status: 200 })),
      );

      const before = 1_700_000_000;
      const cache = makeMapCache();
      cache.store.set(
        `strava:activities:v1:user-1:${before}`,
        JSON.stringify({
          activities: [],
          fetchedAt: Date.now() - 25 * 60 * 60 * 1000,
        }),
      );

      const api = new StravaApi(makeTokenStore(), cache);
      await api.listActivitiesPage("user-1", String(before));

      expect(cache.set).toHaveBeenCalled();
    });

    it("returns stale cache on Strava error", async () => {
      vi.stubGlobal(
        "fetch",
        vi
          .fn()
          .mockResolvedValue(new Response("Rate limited", { status: 429 })),
      );

      const staleActivities = [
        {
          id: 42,
          name: "Old run",
          manual: false,
          distance: 1000,
          moving_time: 3600,
          elapsed_time: 3600,
          total_elevation_gain: 0,
          sport_type: "Run",
          start_date: "2024-01-01T00:00:00Z",
          start_date_local: "2024-01-01T00:00:00Z",
          timezone: "UTC",
          trainer: false,
          commute: false,
          private: false,
          average_speed: 3,
          start_latlng: null,
          end_latlng: null,
          map: { id: "a42", summary_polyline: null },
          max_speed: 5,
        },
      ];
      const cache = makeMapCache();
      cache.store.set(
        "strava:activities:v1:user-1:0",
        JSON.stringify({
          activities: staleActivities,
          fetchedAt: Date.now() - 10 * 60 * 1000,
        }),
      );

      const api = new StravaApi(makeTokenStore(), cache);
      const result = await api.listActivitiesPage("user-1");

      expect(result.activities[0]!.id).toBe(42);
    });

    it("throws on Strava error with no cache", async () => {
      vi.stubGlobal(
        "fetch",
        vi
          .fn()
          .mockResolvedValue(new Response("Rate limited", { status: 429 })),
      );

      const api = new StravaApi(makeTokenStore(), makeNullCache());
      await expect(api.listActivitiesPage("user-1")).rejects.toMatchObject({
        status: 429,
      });
    });

    describe("pagination", () => {
      function makeActivity(i: number, startDateMs: number) {
        return {
          id: i,
          name: `Activity ${i}`,
          manual: false,
          distance: 1000,
          moving_time: 3600,
          elapsed_time: 3600,
          total_elevation_gain: 100,
          sport_type: "Run",
          start_date: new Date(startDateMs).toISOString(),
          start_date_local: new Date(startDateMs).toISOString(),
          timezone: "UTC",
          trainer: false,
          commute: false,
          private: false,
          average_speed: 3,
          start_latlng: null,
          end_latlng: null,
          map: { id: `a${i}`, summary_polyline: null },
          max_speed: 5,
        };
      }

      it("nextCursor is the start_date unix timestamp of the last activity on a full page", async () => {
        const newestMs = 1_700_000_000_000;
        const activities = Array.from({ length: 200 }, (_, i) =>
          makeActivity(i, newestMs - i * 86_400_000),
        );
        const oldestMs = newestMs - 199 * 86_400_000;

        vi.stubGlobal(
          "fetch",
          vi
            .fn()
            .mockResolvedValue(
              new Response(JSON.stringify(activities), { status: 200 }),
            ),
        );

        const api = new StravaApi(makeTokenStore(), makeNullCache());
        const result = await api.listActivitiesPage("user-1");

        const expectedCursor = String(Math.floor(oldestMs / 1000));
        expect(result.nextCursor).toBe(expectedCursor);
      });

      it("nextCursor is null on a partial page", async () => {
        const activities = Array.from({ length: 50 }, (_, i) =>
          makeActivity(i, 1_700_000_000_000 - i * 86_400_000),
        );

        vi.stubGlobal(
          "fetch",
          vi
            .fn()
            .mockResolvedValue(
              new Response(JSON.stringify(activities), { status: 200 }),
            ),
        );

        const api = new StravaApi(makeTokenStore(), makeNullCache());
        const result = await api.listActivitiesPage("user-1");

        expect(result.nextCursor).toBeNull();
      });

      it("passes cursor as before= query param on next page fetch", async () => {
        const mockFetch = vi
          .fn()
          .mockResolvedValue(new Response(JSON.stringify([]), { status: 200 }));
        vi.stubGlobal("fetch", mockFetch);

        const cursor = "1700000000";
        const api = new StravaApi(makeTokenStore(), makeNullCache());
        await api.listActivitiesPage("user-1", cursor);

        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining(`before=${cursor}`),
          expect.anything(),
        );
      });
    });
  });

  describe("getActivityPhotos", () => {
    it("fetches and parses activity photos", async () => {
      const api = new StravaApi(makeTokenStore(), makeNullCache());
      const photos = await api.getActivityPhotos("user-1", 18376823649);
      expect(photos.length).toBeGreaterThan(0);
      const photo = photos[0]!;

      expect(photo.unique_id).toBeTypeOf("string");
      expect(photo.uploaded_at).toBeTypeOf("string");
      expect(photo.created_at).toBeTypeOf("string");
      expect(photo.created_at_local).toMatch(
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/,
      );
      expect(photo.urls).toEqual({
        "2048": expect.stringMatching(/^https?:\/\/.+/),
      });
      expect(photo.sizes).toEqual({
        "2048": expect.arrayContaining([
          expect.any(Number),
          expect.any(Number),
        ]),
      });
      expect(photo.default_photo).toBeTypeOf("boolean");
    });

    it("works with small photo", async () => {
      const api = new StravaApi(makeTokenStore(), makeNullCache());
      const photos = await api.getActivityPhotos("user-1", 16572942720);
      expect(photos.length).toBe(1);
      const photo = photos[0]!;

      expect(photo.urls).toEqual({
        "2048": expect.stringMatching(/^https?:\/\/.+/),
      });
    });
  });

  describe("getActivityStreams", () => {
    it("returns some streams for gpx upload", async () => {
      const api = new StravaApi(makeTokenStore(), makeNullCache());
      const streams = await api.getActivityStreams("user-1", 18376823649, [
        "time",
        "distance",
        "latlng",
        "altitude",
        "velocity_smooth",
        "heartrate",
        "cadence",
        "watts",
        "temp",
        "moving",
        "grade_smooth",
      ]);

      expect(streams.time).toBeDefined();
      expect(streams.time?.data.length).toBeGreaterThan(0);

      expect(streams.latlng).toBeDefined();
      expect(streams.latlng?.data.length).toBeGreaterThan(0);
      expect(streams.latlng?.data[0]).toEqual(
        expect.arrayContaining([expect.any(Number), expect.any(Number)]),
      );
    });
  });

  describe("token handling", () => {
    it("uses the access token from the store", async () => {
      const mockFetch = vi
        .fn()
        .mockResolvedValue(new Response(JSON.stringify([]), { status: 200 }));
      vi.stubGlobal("fetch", mockFetch);

      const tokenStore = makeTokenStore();
      const api = new StravaApi(tokenStore, makeNullCache());
      await api.listActivitiesUncached("user-1", {});

      expect(tokenStore.getTokens).toHaveBeenCalledWith("user-1");

      expect(mockFetch).toHaveBeenCalledOnce();
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining(
          "https://www.strava.com/api/v3/athlete/activities",
        ),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: expect.stringContaining("Bearer "),
          }),
        }),
      );
    });

    it("refreshes token when expiring soon", async () => {
      const mockFetch = vi.fn().mockImplementation(url => {
        if (url === "https://www.strava.com/oauth/token") {
          return Promise.resolve(
            new Response(
              JSON.stringify({
                access_token: "test-access-token",
                refresh_token: "test-refresh-token",
                expires_at: 3600,
              }),
              { status: 200 },
            ),
          );
        } else {
          return Promise.resolve(
            new Response(JSON.stringify([]), { status: 200 }),
          );
        }
      });
      vi.stubGlobal("fetch", mockFetch);

      const expiringSoon = new Date(Date.now() + 2 * 60 * 1000); // 2 min
      const tokenStore = makeTokenStore({
        getTokens: vi.fn().mockResolvedValue({
          accessToken: "expiring-token",
          refreshToken: "my-refresh-token",
          accessTokenExpiresAt: expiringSoon,
        }),
      });

      const api = new StravaApi(tokenStore, makeNullCache());
      await api.listActivitiesUncached("user-1", {});

      expect(mockFetch).toHaveBeenCalledTimes(2);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("https://www.strava.com/oauth/token"),
        expect.objectContaining({
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: expect.stringContaining('"refresh_token":"my-refresh-token"'),
        }),
      );

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining(
          "https://www.strava.com/api/v3/athlete/activities",
        ),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: expect.stringContaining("Bearer "),
          }),
        }),
      );
    });

    it("throws when no connection exists for user", async () => {
      const tokenStore = makeTokenStore({
        getTokens: vi.fn().mockResolvedValue(null),
      });
      const api = new StravaApi(tokenStore, makeNullCache());
      await expect(api.listActivitiesUncached("user-1", {})).rejects.toThrow(
        ClientError,
      );
    });
  });
});

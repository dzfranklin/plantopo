import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { makeFixtureFetch } from "../test/fixture-fetch.js";
import { StravaApi, type TokenStore } from "./strava.api.js";

const fixturesDir = join(import.meta.dirname, "__fixtures__");

const FUTURE = new Date(Date.now() + 60 * 60 * 1000);

if (process.env.RECORD_FIXTURES) {
  if (!process.env.STRAVA_TEST_FIXTURE_ACCESS_TOKEN) {
    if (process.env.STRAVA_TEST_FIXTURE_REFRESH_TOKEN) {
      const client = new StravaApi({
        getTokens: async () => ({
          refreshToken: process.env.STRAVA_TEST_FIXTURE_REFRESH_TOKEN!,
          accessToken: "",
          accessTokenExpiresAt: new Date(0),
        }),
        updateTokens: async (_userId, tokens) => {
          console.log("Update .env.test.local with:");
          console.log("STRAVA_TEST_FIXTURE_ACCESS_TOKEN=" + tokens.accessToken);
          process.exit(1);
        },
      });
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

describe("StravaApi", () => {
  let fixtureFetch: typeof fetch;

  beforeEach(() => {
    fixtureFetch = makeFixtureFetch(fixturesDir);
    vi.stubGlobal("fetch", fixtureFetch);
  });

  describe("getActivity", () => {
    it("fetches and parses a tracked activity", async () => {
      const api = new StravaApi(makeTokenStore());
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
      const api = new StravaApi(makeTokenStore());
      await expect(api.getActivity("user-1", 999)).rejects.toMatchObject({
        status: 401,
      });
    });
  });

  describe("listActivities", () => {
    it("fetches and parses a list of activities", async () => {
      const api = new StravaApi(makeTokenStore());
      const activities = await api.listActivities("user-1", {
        page: 1,
        perPage: 10,
      });
      expect(Array.isArray(activities)).toBe(true);
      expect(activities.length).toBeGreaterThan(0);
      expect(activities[0]!.id).toBeTypeOf("number");
    });

    it("throws StravaApiError on non-ok response", async () => {
      vi.stubGlobal(
        "fetch",
        async () => new Response("Forbidden", { status: 403 }),
      );
      const api = new StravaApi(makeTokenStore());
      await expect(api.listActivities("user-1", {})).rejects.toMatchObject({
        status: 403,
      });
    });
  });

  describe("getActivityPhotos", () => {
    it("fetches and parses activity photos", async () => {
      const api = new StravaApi(makeTokenStore());
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
      const api = new StravaApi(makeTokenStore());
      const photos = await api.getActivityPhotos("user-1", 16572942720);
      expect(photos.length).toBe(1);
      const photo = photos[0]!;

      expect(photo.urls).toEqual({
        "2048": expect.stringMatching(/^https?:\/\/.+/),
      });
    });
  });

  describe("token handling", () => {
    it("uses the access token from the store", async () => {
      const mockFetch = vi
        .fn()
        .mockResolvedValue(new Response(JSON.stringify([]), { status: 200 }));
      vi.stubGlobal("fetch", mockFetch);

      const tokenStore = makeTokenStore();
      const api = new StravaApi(tokenStore);
      await api.listActivities("user-1", {});

      expect(tokenStore.getTokens).toHaveBeenCalledWith("user-1");

      expect(mockFetch).toHaveBeenCalledOnce();
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining(
          "https://www.strava.com/api/v3/athlete/activities",
        ),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: "Bearer test-access-token",
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

      const api = new StravaApi(tokenStore);
      await api.listActivities("user-1", {});

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
            Authorization: "Bearer test-access-token",
          }),
        }),
      );
    });

    it("throws when no connection exists for user", async () => {
      const tokenStore = makeTokenStore({
        getTokens: vi.fn().mockResolvedValue(null),
      });
      const api = new StravaApi(tokenStore);
      await expect(api.listActivities("user-1", {})).rejects.toThrow(
        "No Strava connection",
      );
    });
  });
});

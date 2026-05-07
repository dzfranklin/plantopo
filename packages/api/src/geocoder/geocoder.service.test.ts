import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { makeFixtureFetch } from "../test/fixture-fetch.js";
import { geocode, reverseGeocode } from "./geocoder.service.js";

const fixturesDir = join(import.meta.dirname, "__fixtures__");

describe("geocode", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", makeFixtureFetch(fixturesDir));
  });

  it("returns results for a place name query", async () => {
    const results = await geocode("Edinburgh");
    expect(results.length).toBeGreaterThan(0);
    expect(results[0]!.geometry.type).toBe("Point");
    expect(results[0]!.properties.label).toBeTruthy();
  });

  it("respects the limit option", async () => {
    const results = await geocode("Edinburgh", { limit: 3 });
    expect(results.length).toBeLessThanOrEqual(3);
  });

  it("throws on non-ok response", async () => {
    vi.stubGlobal(
      "fetch",
      async () => new Response("Bad Request", { status: 400 }),
    );
    await expect(geocode("Edinburgh")).rejects.toThrow("400");
  });
});

describe("reverseGeocode", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", makeFixtureFetch(fixturesDir));
  });

  it("returns results for a coordinate", async () => {
    const results = await reverseGeocode([-3.1883, 55.9533]);
    expect(results.length).toBeGreaterThan(0);
    expect(results[0]!.geometry.type).toBe("Point");
  });

  it("returns a label", async () => {
    const results = await reverseGeocode([-3.1883, 55.9533]);
    expect(results[0]!.properties.label).contains("Edinburgh");
  });

  it("throws on non-ok response", async () => {
    vi.stubGlobal(
      "fetch",
      async () => new Response("Bad Request", { status: 400 }),
    );
    await expect(reverseGeocode([-3.1883, 55.9533])).rejects.toThrow("400");
  });
});

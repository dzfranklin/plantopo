import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import pixelmatch from "pixelmatch";
import { PNG } from "pngjs";
import { assert, describe, expect, it } from "vitest";

import type { TileFetcher } from "../tile-cache.js";
import { renderStaticMap } from "./staticmap.js";

const FIXTURES = join(import.meta.dirname, "test-fixtures");
const SNAPSHOTS = join(FIXTURES, "snapshots");

// z10 tiles around central London (tile 511/340)
// Tile bounds: W -0.3516 E 0.0000 N 51.6180 S 51.3992
const OSM_TEMPLATE = "https://a.tile.openstreetmap.org/{z}/{x}/{y}.png";
const LONDON_CENTER: [number, number] = [-0.1758, 51.5086];

async function tileProvider(
  _url: string,
  z: number,
  x: number,
  y: number,
): Promise<Buffer | null> {
  const tilePath = join(FIXTURES, `osm-${z}-${x}-${y}.png`);
  try {
    return await readFile(tilePath);
  } catch {
    // Not cached — download from OSM
  }
  const url = OSM_TEMPLATE.replace("{z}", String(z))
    .replace("{x}", String(x))
    .replace("{y}", String(y));
  const resp = await fetch(url, {
    headers: { "User-Agent": "plantopo-test/1.0" },
  });
  if (!resp.ok) return null;
  const buf = Buffer.from(await resp.arrayBuffer());
  await writeFile(tilePath, buf);
  return buf;
}

// On first run (no snapshot yet): write it and return true so the test passes.
// On subsequent runs: pixel-diff against the snapshot, return true if within threshold.
async function expectMatchesSnapshot(
  buf: Buffer,
  name: string,
  threshold = 0,
): Promise<void> {
  const snapshotPath = join(SNAPSHOTS, `${name}.png`);
  let snapshotBuf: Buffer;
  try {
    snapshotBuf = await readFile(snapshotPath);
  } catch {
    // First run — write snapshot for manual inspection
    await writeFile(snapshotPath, buf);
    assert(
      false,
      `Snapshot ${name} did not exist, created it. Please verify the output and re-run the test.`,
    );
  }

  const actual = PNG.sync.read(buf);
  const expected = PNG.sync.read(snapshotBuf);

  assert(
    actual.width === expected.width && actual.height === expected.height,
    `Actual image dimensions ${actual.width}x${actual.height} do not match snapshot dimensions ${expected.width}x${expected.height}`,
  );

  const diff = new PNG({ width: actual.width, height: actual.height });
  const diffCount = pixelmatch(
    actual.data,
    expected.data,
    diff.data,
    actual.width,
    actual.height,
    { threshold: 0.1 },
  );

  if (diffCount > threshold) {
    const diffPath = join(SNAPSHOTS, `${name}-diff.png`);
    const actualPath = join(SNAPSHOTS, `${name}-actual.png`);
    await writeFile(actualPath, buf);
    await writeFile(diffPath, PNG.sync.write(diff));
    assert(
      false,
      `Output did not match snapshot for ${name}. Diff count: ${diffCount}. See ${diffPath} for pixel differences.`,
    );
  }
}

const BASE_OPTS = {
  width: 300,
  height: 200,
  source: { tiles: OSM_TEMPLATE },
  tileProvider,
} as const;

describe("renderStaticMap", () => {
  it("renders without error given valid source and no features", async () => {
    const buf = await renderStaticMap({
      ...BASE_OPTS,
      zoom: 10,
      center: LONDON_CENTER,
    });
    expect(buf.length).toBeGreaterThan(0);
    // Valid PNG header
    expect(buf.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
  });

  it("renders gracefully when a tile returns null", async () => {
    const nullProvider: TileFetcher = async () => null;
    const buf = await renderStaticMap({
      ...BASE_OPTS,
      zoom: 10,
      center: LONDON_CENTER,
      tileProvider: nullProvider,
    });
    // Should produce a plain white image, not throw
    expect(buf.length).toBeGreaterThan(0);
    expect(buf.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
  });

  it("handles date-line wrapping without crashing", async () => {
    const buf = await renderStaticMap({
      width: 256,
      height: 256,
      source: { tiles: OSM_TEMPLATE, tileSize: 256 },
      zoom: 3,
      center: [179.9, 0],
      tileProvider: async () => null,
    });
    expect(buf.length).toBeGreaterThan(0);
  });

  it("throws when map is empty with no center+zoom", async () => {
    await expect(
      renderStaticMap({
        width: 300,
        height: 200,
        source: { tiles: OSM_TEMPLATE, tileSize: 256 },
        tileProvider,
      }),
    ).rejects.toThrow("cannot render empty map");
  });

  it("retina option doubles resolution and scale", async () => {
    const buf = await renderStaticMap({
      ...BASE_OPTS,
      width: 300,
      height: 200,
      zoom: 10,
      center: LONDON_CENTER,
      retina: true,
    });
    const img = PNG.sync.read(buf);
    expect(img.width).toBe(600);
    expect(img.height).toBe(400);
  });

  describe.skipIf(process.env.CI)("snapshots", () => {
    it("Point, LineString, and Polygon features render correctly", async () => {
      const buf = await renderStaticMap({
        ...BASE_OPTS,
        features: [
          {
            type: "Feature" as const,
            geometry: {
              type: "Polygon" as const,
              coordinates: [
                [
                  [-0.3, 51.45],
                  [-0.05, 51.45],
                  [-0.05, 51.57],
                  [-0.3, 51.57],
                  [-0.3, 51.45],
                ],
              ],
            },
            properties: {
              fill: "#457b9d",
              "fill-opacity": 0.4,
              stroke: "#1d3557",
              "stroke-width": 2,
            },
          },
          {
            type: "Feature" as const,
            geometry: {
              type: "LineString" as const,
              coordinates: [
                [-0.35, 51.45],
                [-0.1, 51.55],
                [0.0, 51.4],
              ],
            },
            properties: { stroke: "#ffffff", "stroke-width": 8 },
          },
          {
            type: "Feature" as const,
            geometry: {
              type: "LineString" as const,
              coordinates: [
                [-0.35, 51.45],
                [-0.1, 51.55],
                [0.0, 51.4],
              ],
            },
            properties: { stroke: "#e63946", "stroke-width": 4 },
          },
          {
            type: "Feature" as const,
            geometry: { type: "Point" as const, coordinates: LONDON_CENTER },
            properties: {
              "marker-color": "#e63946",
              "marker-size": "large" as const,
            },
          },
        ],
      });
      await expectMatchesSnapshot(buf, "features");
    });

    it("renders line at correct points", async () => {
      // Exactly spans Kincardine bridge
      const buf = await renderStaticMap({
        ...BASE_OPTS,
        features: [
          {
            type: "Feature",
            properties: {
              stroke: "magenta",
            },
            geometry: {
              type: "LineString",
              coordinates: [
                [-3.72322, 56.06642],
                [-3.73392, 56.06311],
              ],
            },
          },
        ],
      });
      await expectMatchesSnapshot(buf, "bridge-line");
    });

    it("renders attribution", async () => {
      const buf = await renderStaticMap({
        ...BASE_OPTS,
        width: 800,
        height: 400,
        source: {
          tiles: OSM_TEMPLATE,
          attribution: "© OpenStreetMap",
        },
        features: [
          {
            type: "Feature",
            properties: {
              stroke: "magenta",
            },
            geometry: {
              type: "LineString",
              coordinates: [
                [-3.72322, 56.06642],
                [-3.73392, 56.06311],
              ],
            },
          },
        ],
      });
      await expectMatchesSnapshot(buf, "attribution");
    });

    it("renders retina", async () => {
      const buf = await renderStaticMap({
        ...BASE_OPTS,
        width: 200,
        height: 100,
        retina: true,
        source: {
          ...BASE_OPTS.source,
          attribution: "© OpenStreetMap",
        },
        features: [
          {
            type: "Feature" as const,
            geometry: {
              type: "Polygon" as const,
              coordinates: [
                [
                  [-0.3, 51.45],
                  [-0.05, 51.45],
                  [-0.05, 51.57],
                  [-0.3, 51.57],
                  [-0.3, 51.45],
                ],
              ],
            },
            properties: {
              fill: "#457b9d",
              "fill-opacity": 0.4,
              stroke: "#1d3557",
              "stroke-width": 2,
            },
          },
          {
            type: "Feature" as const,
            geometry: {
              type: "LineString" as const,
              coordinates: [
                [-0.35, 51.45],
                [-0.1, 51.55],
                [0.0, 51.4],
              ],
            },
            properties: { stroke: "#ffffff", "stroke-width": 8 },
          },
          {
            type: "Feature" as const,
            geometry: {
              type: "LineString" as const,
              coordinates: [
                [-0.35, 51.45],
                [-0.1, 51.55],
                [0.0, 51.4],
              ],
            },
            properties: { stroke: "#e63946", "stroke-width": 4 },
          },
          {
            type: "Feature" as const,
            geometry: { type: "Point" as const, coordinates: LONDON_CENTER },
            properties: {
              "marker-color": "#e63946",
              "marker-size": "large" as const,
            },
          },
        ],
      });
      await expectMatchesSnapshot(buf, "retina");
    });
  });
});

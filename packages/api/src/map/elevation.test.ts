import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";

import { type TileProvider, getElevations } from "./elevation.js";
import { defaultDEMSource, eduDEMSource } from "./style.js";

const FIXTURES = join(import.meta.dirname, "test-fixtures");

// Ben Nevis summit: 1,345 m
const BEN_NEVIS: [number, number] = [-5.0035, 56.7969];
// Fort William town centre: ~13 m
const FORT_WILLIAM: [number, number] = [-5.1066, 56.8198];

// Mapterhorn uses terrarium encoding, maxzoom 12, 512px
function mapterhornProvider(): TileProvider {
  return async (_urlTemplate, z, x, y) =>
    readFile(join(FIXTURES, `mapterhorn-${z}-${x}-${y}.webp`));
}

// Maptiler terrain-rgb-v2 uses mapbox encoding, maxzoom 14, 512px —
// same encoding as the edu source, exercising the mapbox decode path.
function maptilerProvider(): TileProvider {
  return async (_urlTemplate, z, x, y) =>
    readFile(join(FIXTURES, `maptiler-${z}-${x}-${y}.webp`));
}

describe("getElevations — terrarium encoding (mapterhorn)", () => {
  it("returns a plausible elevation near Ben Nevis summit", async () => {
    const { data } = await getElevations([BEN_NEVIS], [], mapterhornProvider());
    expect(data[0]).not.toBeNull();
    expect(data[0]!).toBeGreaterThan(1100);
    expect(data[0]!).toBeLessThanOrEqual(1345);
  });

  it("returns a low elevation for Fort William", async () => {
    const { data } = await getElevations(
      [FORT_WILLIAM],
      [],
      mapterhornProvider(),
    );
    expect(data[0]).not.toBeNull();
    expect(data[0]!).toBeGreaterThanOrEqual(0);
    expect(data[0]!).toBeLessThan(50);
  });

  it("returns null for a point outside source bounds", async () => {
    const { data } = await getElevations([[200, 0]], [], mapterhornProvider());
    expect(data[0]).toBeNull();
  });

  it("elevations are rounded to one decimal place", async () => {
    const { data } = await getElevations([BEN_NEVIS], [], mapterhornProvider());
    const elev = data[0]!;
    expect(elev).toBe(Math.round(elev * 10) / 10);
  });

  it("fetches each tile only once for multiple points in the same tile", async () => {
    let fetchCount = 0;
    const countingProvider: TileProvider = async (_url, z, x, y) => {
      fetchCount++;
      return readFile(join(FIXTURES, `mapterhorn-${z}-${x}-${y}.webp`));
    };
    // Both points are in the same z12 tile
    await getElevations([BEN_NEVIS, BEN_NEVIS], [], countingProvider);
    expect(fetchCount).toBe(1);
  });

  it("fetches neighbour tile when bilinear window crosses a tile edge", async () => {
    // pxf ≈ 511.9 in tile 1991/1259 — px1 spills into tile 1992/1259
    const ON_RIGHT_EDGE: [number, number] = [-4.921892166137695, 56.7969];
    const fetched = new Set<string>();
    const trackingProvider: TileProvider = async (_url, z, x, y) => {
      fetched.add(`${z}-${x}-${y}`);
      return readFile(join(FIXTURES, `mapterhorn-${z}-${x}-${y}.webp`));
    };
    await getElevations([ON_RIGHT_EDGE], [], trackingProvider);
    expect(fetched.has("12-1991-1259")).toBe(true);
    expect(fetched.has("12-1992-1259")).toBe(true);
  });

  it("returns correct meta for the default source", async () => {
    const { meta } = await getElevations([BEN_NEVIS], [], mapterhornProvider());
    expect(meta.sources[0]!.tiles).toBe(defaultDEMSource.tiles![0]);
    expect(meta.sources[0]!.zoom).toBe(defaultDEMSource.maxzoom);
  });
});

describe("source selection", () => {
  const nullProvider: TileProvider = vi.fn().mockResolvedValue(Buffer.alloc(0));

  it("uses the default source when no edu scope", async () => {
    await getElevations([BEN_NEVIS], [], nullProvider).catch(() => {});
    expect(vi.mocked(nullProvider)).toHaveBeenCalledWith(
      defaultDEMSource.tiles![0],
      expect.any(Number),
      expect.any(Number),
      expect.any(Number),
    );
  });

  it("uses the default source when edu scope but point is outside edu bounds", async () => {
    const outsideEdu: [number, number] = [-10, 40]; // within default, outside edu
    await getElevations([outsideEdu], ["edu"], nullProvider).catch(() => {});
    expect(vi.mocked(nullProvider)).toHaveBeenCalledWith(
      defaultDEMSource.tiles![0],
      expect.any(Number),
      expect.any(Number),
      expect.any(Number),
    );
  });

  it("uses the edu source when edu scope and all points are within edu bounds", async () => {
    await getElevations([BEN_NEVIS], ["edu"], nullProvider).catch(() => {});
    expect(vi.mocked(nullProvider)).toHaveBeenCalledWith(
      eduDEMSource.tiles![0],
      expect.any(Number),
      expect.any(Number),
      expect.any(Number),
    );
  });

  it("returns correct meta for the edu source", async () => {
    const { meta } = await getElevations(
      [BEN_NEVIS],
      ["edu"],
      maptilerProvider(),
    );
    expect(meta.sources[0]!.tiles).toBe(eduDEMSource.tiles![0]);
    expect(meta.sources[0]!.zoom).toBe(eduDEMSource.maxzoom);
  });
});

describe("getElevations — mapbox encoding (maptiler terrain-rgb-v2)", () => {
  // Both points are within edu source bounds (UK), so "edu" scope selects
  // the edu/mapbox source, exercising the mapbox decode path.
  const EDU_SCOPES = ["edu"];

  it("returns a plausible elevation near Ben Nevis summit", async () => {
    const { data } = await getElevations(
      [BEN_NEVIS],
      EDU_SCOPES,
      maptilerProvider(),
    );
    expect(data[0]).not.toBeNull();
    expect(data[0]!).toBeGreaterThan(1000);
    expect(data[0]!).toBeLessThanOrEqual(1345);
  });

  it("returns a low elevation for Fort William", async () => {
    const { data } = await getElevations(
      [FORT_WILLIAM],
      EDU_SCOPES,
      maptilerProvider(),
    );
    expect(data[0]).not.toBeNull();
    expect(data[0]!).toBeGreaterThanOrEqual(0);
    expect(data[0]!).toBeLessThan(50);
  });
});

import { TRPCError } from "@trpc/server";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import sharp from "sharp";

import { env } from "../env.js";
import { logger } from "../logger.js";
import { defaultDEMSource, eduDEMSource } from "../map/style.js";

// [lng, lat] GeoJSON order
type Point = [number, number];

type DEMSource = {
  urlTemplate: string;
  encoding: "terrarium" | "mapbox";
  maxzoom: number;
  tileSize: number;
  bounds: [number, number, number, number]; // [west, south, east, north]
};

export type TileProvider = (
  urlTemplate: string,
  z: number,
  x: number,
  y: number,
) => Promise<Buffer | null>;

function sourceFromSpec(
  spec: typeof defaultDEMSource | typeof eduDEMSource,
): DEMSource {
  return {
    urlTemplate: spec.tiles![0]!,
    encoding: spec.encoding as "terrarium" | "mapbox",
    maxzoom: spec.maxzoom!,
    tileSize: spec.tileSize ?? 512,
    bounds: spec.bounds as [number, number, number, number],
  };
}

const DEFAULT_SOURCE = sourceFromSpec(defaultDEMSource);
const EDU_SOURCE = sourceFromSpec(eduDEMSource);

function selectSource(points: Point[], accessScopes: string[]): DEMSource {
  if (!accessScopes.includes("edu")) return DEFAULT_SOURCE;
  const [west, south, east, north] = EDU_SOURCE.bounds;
  const allInBounds = points.every(
    ([lng, lat]) => lng >= west && lng <= east && lat >= south && lat <= north,
  );
  return allInBounds ? EDU_SOURCE : DEFAULT_SOURCE;
}

// Tile coordinate math

function lngLatToTileCoords(
  lng: number,
  lat: number,
  zoom: number,
  tileSize: number,
): { x: number; y: number; pxf: number; pyf: number } {
  const n = Math.pow(2, zoom);
  const xf = ((lng + 180) / 360) * n;
  const latRad = (lat * Math.PI) / 180;
  const yf =
    ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n;

  const x = Math.floor(xf);
  const y = Math.floor(yf);
  // Fractional pixel position within the tile (0..tileSize)
  const pxf = (xf - x) * tileSize;
  const pyf = (yf - y) * tileSize;

  return { x, y, pxf, pyf };
}

// Disk-cached tile provider with in-flight deduplication

function sourceCacheKey(urlTemplate: string): string {
  const hostname = new URL(
    urlTemplate.replace("{z}", "0").replace("{x}", "0").replace("{y}", "0"),
  ).hostname;
  const hash = createHash("sha256")
    .update(urlTemplate)
    .digest("hex")
    .slice(0, 8);
  return `${hostname}-${hash}`;
}

const inFlight = new Map<string, Promise<Buffer | null>>();

export function getCachingTileProvider(): TileProvider {
  return (urlTemplate, z, x, y) =>
    cachingFetch(urlTemplate, z, x, y, env.SERVER_TILE_KEY);
}

function cachingFetch(
  urlTemplate: string,
  z: number,
  x: number,
  y: number,
  tileKey: string | undefined,
): Promise<Buffer | null> {
  const sourceKey = sourceCacheKey(urlTemplate);
  const cacheKey = `${sourceKey}/${z}/${x}/${y}`;

  const existing = inFlight.get(cacheKey);
  if (existing) return existing;

  const promise = (async (): Promise<Buffer | null> => {
    const cacheDir = join(env.TILE_CACHE_DIR, sourceKey, String(z), String(x));
    const cachePath = join(cacheDir, String(y));
    try {
      const cached = await readFile(cachePath);
      return cached.length === 0 ? null : cached;
    } catch {
      // Cache miss — fetch
    }

    let url = urlTemplate
      .replace("{z}", String(z))
      .replace("{x}", String(x))
      .replace("{y}", String(y));

    if (tileKey && url.startsWith("https://tile.plantopo.com")) {
      url += url.includes("?") ? `&key=${tileKey}` : `?key=${tileKey}`;
    }

    logger.debug({ url }, "Fetching elevation tile");
    let buf: Buffer<ArrayBuffer>;
    try {
      const resp = await fetch(url);
      if (resp.status === 404) {
        await mkdir(cacheDir, { recursive: true });
        await writeFile(cachePath, "");
        return null;
      }
      if (!resp.ok) {
        throw new Error(`Failed to fetch elevation tile ${resp.status}`);
      }

      buf = Buffer.from(await resp.arrayBuffer());
    } catch (err) {
      logger.error({ url, error: err }, "Error fetching elevation tile");
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: `Error fetching elevation tile`,
      });
    }

    await mkdir(cacheDir, { recursive: true });
    await writeFile(cachePath, buf);

    return buf;
  })();

  inFlight.set(cacheKey, promise);
  promise.finally(() => inFlight.delete(cacheKey));

  return promise;
}

// Elevation decode

function decodeElevation(
  rgba: Buffer,
  offset: number,
  encoding: "terrarium" | "mapbox",
): number {
  const r = rgba[offset]!;
  const g = rgba[offset + 1]!;
  const b = rgba[offset + 2]!;

  if (encoding === "terrarium") {
    return r * 256 + g + b / 256 - 32768;
  } else {
    return -10000 + (r * 65536 + g * 256 + b) * 0.1;
  }
}

type TilePixel = { x: number; y: number; pxf: number; pyf: number } | null;

export type ElevationResult = {
  data: (number | null)[];
  meta: {
    sources: { tiles: string; zoom: number }[];
  };
};

export async function getElevations(
  points: Point[],
  accessScopes: string[],
  tileProvider: TileProvider = getCachingTileProvider(),
): Promise<ElevationResult> {
  if (points.length === 0) {
    return {
      data: [],
      meta: {
        sources: [],
      },
    };
  }

  const source = selectSource(points, accessScopes);
  const [west, south, east, north] = source.bounds;

  // Compute tile coords for each point (null if out of bounds)
  const coords: TilePixel[] = points.map(([lng, lat]) => {
    if (lng < west || lng > east || lat < south || lat > north) return null;
    return lngLatToTileCoords(lng, lat, source.maxzoom, source.tileSize);
  });

  // Collect all unique tiles needed — bilinear can spill into an adjacent tile at edges
  const tileKey = (x: number, y: number) => `${x}/${y}`;
  const tileMax = Math.pow(2, source.maxzoom) - 1;
  const uniqueTiles = new Map<string, { x: number; y: number }>();
  for (const c of coords) {
    if (!c) continue;
    uniqueTiles.set(tileKey(c.x, c.y), { x: c.x, y: c.y });
    // If the bilinear 2×2 window spills into a neighbour tile, include it.
    // px1 = floor(pxf - 0.5) + 1 >= tileSize when pxf >= tileSize - 0.5
    const spillX = c.pxf >= source.tileSize - 0.5 && c.x < tileMax;
    const spillY = c.pyf >= source.tileSize - 0.5 && c.y < tileMax;
    if (spillX) uniqueTiles.set(tileKey(c.x + 1, c.y), { x: c.x + 1, y: c.y });
    if (spillY) uniqueTiles.set(tileKey(c.x, c.y + 1), { x: c.x, y: c.y + 1 });
    if (spillX && spillY)
      uniqueTiles.set(tileKey(c.x + 1, c.y + 1), { x: c.x + 1, y: c.y + 1 });
  }

  const decodedTiles = new Map<string, Buffer>();
  await Promise.all(
    Array.from(uniqueTiles.values()).map(async ({ x, y }) => {
      const key = tileKey(x, y);
      const buf = await tileProvider(source.urlTemplate, source.maxzoom, x, y);
      if (buf === null) return;
      const { data } = await sharp(buf)
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });
      decodedTiles.set(key, data as unknown as Buffer);
    }),
  );

  // Bilinear interpolation, handling pixels that spill into a neighbour tile
  function sampleBilinear(c: NonNullable<TilePixel>): number {
    const { tileSize } = source;

    // Top-left pixel of the 2×2 sample, centred on pixel centres
    const px0 = Math.max(Math.floor(c.pxf - 0.5), 0);
    const py0 = Math.max(Math.floor(c.pyf - 0.5), 0);
    const px1 = px0 + 1;
    const py1 = py0 + 1;
    const fx = c.pxf - 0.5 - px0;
    const fy = c.pyf - 0.5 - py0;

    // Resolve pixel coords that overflow into a neighbour tile.
    // If the neighbour wasn't fetched (outside source bounds), clamp to the edge pixel.
    function sample(px: number, py: number): number {
      let tx = c.x,
        ty = c.y,
        lpx = px,
        lpy = py;
      if (lpx >= tileSize) {
        tx++;
        lpx = 0;
      }
      if (lpy >= tileSize) {
        ty++;
        lpy = 0;
      }
      const rgba = decodedTiles.get(tileKey(tx, ty));
      if (rgba) {
        return decodeElevation(
          rgba,
          (lpy * tileSize + lpx) * 4,
          source.encoding,
        );
      }
      // Neighbour outside source bounds — clamp to the primary tile's edge pixel
      const clampedPx = Math.min(px, tileSize - 1);
      const clampedPy = Math.min(py, tileSize - 1);
      const primaryRgba = decodedTiles.get(tileKey(c.x, c.y))!;
      return decodeElevation(
        primaryRgba,
        (clampedPy * tileSize + clampedPx) * 4,
        source.encoding,
      );
    }

    const v00 = sample(px0, py0);
    const v10 = sample(px1, py0);
    const v01 = sample(px0, py1);
    const v11 = sample(px1, py1);

    return (
      v00 * (1 - fx) * (1 - fy) +
      v10 * fx * (1 - fy) +
      v01 * (1 - fx) * fy +
      v11 * fx * fy
    );
  }

  const data = coords.map(c => {
    if (!c) return null;
    if (!decodedTiles.has(tileKey(c.x, c.y))) return null;
    const elev = sampleBilinear(c);
    return Math.round(elev * 10) / 10;
  });

  return {
    data,
    meta: { sources: [{ tiles: source.urlTemplate, zoom: source.maxzoom }] },
  };
}

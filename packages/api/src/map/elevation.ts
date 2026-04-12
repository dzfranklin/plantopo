import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import sharp from "sharp";

import { env } from "../env.js";
import { logger } from "../logger.js";
import { defaultDEMSource, eduDEMSource } from "./style.js";

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
) => Promise<Buffer>;

function sourceFromSpec(
  spec: typeof defaultDEMSource | typeof eduDEMSource,
): DEMSource {
  return {
    urlTemplate: spec.tiles![0]!,
    encoding: spec.encoding as "terrarium" | "mapbox",
    maxzoom: spec.maxzoom!,
    tileSize: spec.tileSize ?? 256,
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
): { x: number; y: number; px: number; py: number } {
  const n = Math.pow(2, zoom);
  const xf = ((lng + 180) / 360) * n;
  const latRad = (lat * Math.PI) / 180;
  const yf =
    ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n;

  const x = Math.floor(xf);
  const y = Math.floor(yf);
  const px = Math.floor((xf - x) * tileSize);
  const py = Math.floor((yf - y) * tileSize);

  return { x, y, px, py };
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

const inFlight = new Map<string, Promise<Buffer>>();

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
): Promise<Buffer> {
  const sourceKey = sourceCacheKey(urlTemplate);
  const cacheKey = `${sourceKey}/${z}/${x}/${y}`;

  const existing = inFlight.get(cacheKey);
  if (existing) return existing;

  const promise = (async (): Promise<Buffer> => {
    const cachePath = join(
      env.TILE_CACHE_DIR,
      sourceKey,
      String(z),
      String(x),
      String(y),
    );
    try {
      return await readFile(cachePath);
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
    const resp = await fetch(url);
    if (!resp.ok) {
      throw new Error(
        `Failed to fetch tile ${url}: ${resp.status} ${await resp.text()}`,
      );
    }

    const buf = Buffer.from(await resp.arrayBuffer());

    await mkdir(join(env.TILE_CACHE_DIR, sourceKey, String(z), String(x)), {
      recursive: true,
    });
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

type TilePixel = { x: number; y: number; px: number; py: number } | null;

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
        sources: [
          { tiles: DEFAULT_SOURCE.urlTemplate, zoom: DEFAULT_SOURCE.maxzoom },
        ],
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

  // Fetch and decode each unique tile once
  const tileKey = (x: number, y: number) => `${x}/${y}`;
  const uniqueTiles = new Map<string, { x: number; y: number }>();
  for (const c of coords) {
    if (c) uniqueTiles.set(tileKey(c.x, c.y), { x: c.x, y: c.y });
  }

  const decodedTiles = new Map<string, Buffer>();
  await Promise.all(
    Array.from(uniqueTiles.values()).map(async ({ x, y }) => {
      const key = tileKey(x, y);
      const buf = await tileProvider(source.urlTemplate, source.maxzoom, x, y);
      const { data } = await sharp(buf)
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });
      decodedTiles.set(key, data as unknown as Buffer);
    }),
  );

  const data = coords.map(c => {
    if (!c) return null;
    const rgba = decodedTiles.get(tileKey(c.x, c.y))!;
    const offset = (c.py * source.tileSize + c.px) * 4;
    const elev = decodeElevation(rgba, offset, source.encoding);
    return Math.round(elev * 10) / 10;
  });

  return {
    data,
    meta: { sources: [{ tiles: source.urlTemplate, zoom: source.maxzoom }] },
  };
}

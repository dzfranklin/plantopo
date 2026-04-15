import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { env } from "./env.js";
import { logger } from "./logger.js";

export type TileFetcher = (
  urlTemplate: string,
  z: number,
  x: number,
  y: number,
) => Promise<Buffer | null>;

const inFlight = new Map<string, Promise<Buffer | null>>();

// Disk-cached tile provider with in-flight deduplication
export function fetchTile(
  urlTemplate: string,
  z: number,
  x: number,
  y: number,
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

    if (url.startsWith("https://tile.plantopo.com")) {
      url += url.includes("?")
        ? `&key=${env.SERVER_TILE_KEY}`
        : `?key=${env.SERVER_TILE_KEY}`;
    }

    logger.debug({ url }, "Fetching staticmap tile");
    let buf: Buffer<ArrayBuffer>;
    try {
      const resp = await fetch(url);
      if (resp.status === 404) {
        await mkdir(cacheDir, { recursive: true });
        await writeFile(cachePath, "");
        return null;
      }
      if (!resp.ok) {
        throw new Error(`Failed to fetch tile ${resp.status}`);
      }
      buf = Buffer.from(await resp.arrayBuffer());
    } catch (err) {
      logger.error({ url, err }, "Error fetching staticmap tile");
      throw err;
    }

    await mkdir(cacheDir, { recursive: true });
    await writeFile(cachePath, buf);

    return buf;
  })();

  inFlight.set(cacheKey, promise);
  promise.finally(() => inFlight.delete(cacheKey));

  return promise;
}

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

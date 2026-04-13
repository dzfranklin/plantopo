import { TRPCError } from "@trpc/server";
import type ml from "maplibre-gl";
import z from "zod";

import { round2 } from "@pt/shared";
import type { AppStyle, StyleCatalog } from "@pt/shared/style.js";

import { env } from "../env.js";
import { logger } from "../logger.js";
import { decodePolyline } from "./polyline.js";
import {
  type FullCatalog,
  buildFullStyleCatalog,
  customizeStyleCatalog,
  stylesToMeta,
} from "./style.js";

const MARTIN_ENDPOINT = "https://tile.plantopo.com";
const CACHED_CATALOG_EXPIRY = 5 * 60 * 1000; // 5 minutes

let cachedFullCatalog: Promise<[number, FullCatalog]> | undefined;

export async function getCatalog(
  accessScopes: string[],
): Promise<StyleCatalog> {
  const fullCatalog = await loadCustomizedCatalog(accessScopes, undefined);
  return {
    styles: stylesToMeta(fullCatalog.styles),
    overlays: stylesToMeta(fullCatalog.overlays),
  };
}

export async function getStyle(
  name: string,
  accessScopes: string[],
  tileKey: string | undefined,
): Promise<AppStyle> {
  const fullCatalog = await loadCustomizedCatalog(accessScopes, tileKey);
  const style = fullCatalog.styles[name];
  if (!style) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: `Style ${name} not found or access denied`,
    });
  }
  return style;
}

export async function getOverlay(
  name: string,
  accessScopes: string[],
  tileKey: string | undefined,
): Promise<AppStyle> {
  const fullCatalog = await loadCustomizedCatalog(accessScopes, tileKey);
  const overlay = fullCatalog.overlays[name];
  if (!overlay) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: `Overlay ${name} not found or access denied`,
    });
  }
  return overlay;
}

async function loadFullCatalog(): Promise<FullCatalog> {
  if (cachedFullCatalog) {
    const [timestamp, catalog] = await cachedFullCatalog;
    if (Date.now() - timestamp < CACHED_CATALOG_EXPIRY) {
      return catalog;
    }
  }

  const newCatalog = (async (): Promise<[number, FullCatalog]> => {
    logger.info("Fetching style catalog from tile server...");
    const timestamp = Date.now();
    const { styles, overlays } = await fetchAllStyleBases();
    const catalog = buildFullStyleCatalog(styles, overlays);
    return [timestamp, catalog];
  })();
  cachedFullCatalog = newCatalog;

  try {
    const [, catalog] = await newCatalog;
    return catalog;
  } catch (err) {
    cachedFullCatalog = undefined;
    throw err;
  }
}

async function loadCustomizedCatalog(
  accessScopes: string[],
  tileKey: string | undefined,
): Promise<FullCatalog> {
  const fullCatalog = await loadFullCatalog();
  return customizeStyleCatalog(fullCatalog, accessScopes, tileKey);
}

async function fetchStyleNameList(): Promise<string[]> {
  const resp = await fetch(`${MARTIN_ENDPOINT}/catalog`);
  if (!resp.ok)
    throw new Error(
      `Failed to fetch /catalog: ${resp.status} ${await resp.text()}`,
    );
  const data = (await resp.json()) as { styles: Record<string, unknown> };
  return Object.keys(data.styles);
}

async function fetchStyleBase(
  name: string,
  sourceCache: Map<string, ml.SourceSpecification>,
): Promise<ml.StyleSpecification> {
  const resp = await fetch(`${MARTIN_ENDPOINT}/style/${name}`);
  if (!resp.ok)
    throw new Error(
      `Failed to fetch /style/${name}: ${resp.status} ${await resp.text()}`,
    );
  const style = (await resp.json()) as ml.StyleSpecification;
  return await inlineSources(style, sourceCache);
}

async function inlineSources(
  style: ml.StyleSpecification,
  sourceCache: Map<string, ml.SourceSpecification>,
): Promise<ml.StyleSpecification> {
  const sources = await Promise.all(
    Object.entries(style.sources).map(([id, source]) =>
      inlineSource(source, sourceCache).then(inlined => [id, inlined] as const),
    ),
  ).then(Object.fromEntries);
  return { ...style, sources };
}

async function inlineSource(
  source: ml.SourceSpecification,
  sourceCache: Map<string, ml.SourceSpecification>,
): Promise<ml.SourceSpecification> {
  if ("url" in source && source.url) {
    const { url, ...rest } = source;
    const remote = await fetchSource(url, sourceCache);
    return { ...remote, ...rest } as ml.SourceSpecification;
  }
  return source;
}

async function fetchSource(
  url: string,
  sourceCache: Map<string, ml.SourceSpecification>,
): Promise<ml.SourceSpecification> {
  const cached = sourceCache.get(url);
  if (cached) return cached;

  const resp = await fetch(url);
  if (!resp.ok)
    throw new Error(
      `Failed to fetch source ${url}: ${resp.status} ${await resp.text()}`,
    );
  const remote = (await resp.json()) as ml.SourceSpecification;
  sourceCache.set(url, remote);
  return remote;
}

async function fetchAllStyleBases(): Promise<{
  styles: Record<string, ml.StyleSpecification>;
  overlays: Record<string, ml.StyleSpecification>;
}> {
  const names = await fetchStyleNameList();
  const sourceCache = new Map<string, ml.SourceSpecification>();
  const entries = await Promise.all(
    names.map(
      async name => [name, await fetchStyleBase(name, sourceCache)] as const,
    ),
  );
  const styles: Record<string, ml.StyleSpecification> = {};
  const overlays: Record<string, ml.StyleSpecification> = {};
  for (const [name, base] of entries) {
    if (name.endsWith(".overlay")) {
      overlays[name] = base;
    } else {
      styles[name] = base;
    }
  }
  return { styles, overlays };
}

export async function completeRouteBetween(
  a: [number, number],
  b: [number, number],
): Promise<[number, number][]> {
  if (!env.VALHALLA) throw new Error("Valhalla not configured");

  a = round2(a, 6);
  b = round2(b, 6);

  const payload = {
    costing: "pedestrian",
    costing_options: {
      pedestrian: {
        use_ferry: 1,
        use_living_streets: 1,
        use_tracks: 1,
        private_access_penalty: 0,
        destination_only_penalty: 0,
        elevator_penalty: 120,
        service_penalty: 0,
        service_factor: 1,
        shortest: false,
        type: "Foot",
        use_hills: 1,
        walking_speed: 5.1,
        walkway_factor: 1,
        sidewalk_factor: 1,
        alley_factor: 1,
        driveway_factor: 1,
        step_penalty: 0,
        max_hiking_difficulty: 6,
        use_lit: 0,
      },
    },
    locations: [
      { lon: a[0], lat: a[1], type: "break" },
      { lon: b[0], lat: b[1], type: "break" },
    ],
    alternates: 0,
    directions_type: "none",
  };

  const ResponseSchema = z.looseObject({
    error_code: z.number().optional(),
    status_code: z.number().optional(),
    error: z.string().optional(),
    trip: z
      .looseObject({
        legs: z.array(
          z.looseObject({
            shape: z.string(),
          }),
        ),
      })
      .optional(),
  });

  const resp = await fetch(env.VALHALLA + "/route", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  const body = await resp.json();
  const result = ResponseSchema.parse(body);
  if (result.error_code) {
    const code = result.error_code;
    if ((code >= 150 && code <= 158) || code === 442) {
      return [];
    } else {
      throw new Error(`Valhalla ${result.error_code}: ${result.error}`);
    }
  }
  const trip = result.trip!;

  if (trip.legs.length === 0) return [];
  return decodePolyline(trip.legs[0]!.shape);
}

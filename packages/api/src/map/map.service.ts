import { TRPCError } from "@trpc/server";
import type ml from "maplibre-gl";

import type { AppStyle, StyleCatalog } from "@pt/shared/style.js";

import { logger } from "../logger.js";
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

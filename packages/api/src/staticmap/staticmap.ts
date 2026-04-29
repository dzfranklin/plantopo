// Based on <https://github.com/komoot/staticmap/>
import { type CanvasRenderingContext2D, createCanvas, loadImage } from "canvas";
import type GeoJSON from "geojson";
import z from "zod";

import { type TileFetcher, fetchTile } from "../tile-cache.js";
import { ensureFonts } from "./ensure-fonts.js";

export const SourceSchema = z.object({
  tiles: z.string(),
  tileSize: z.number().optional(), // default 256
  attribution: z.string().optional(),
});

export type Source = z.infer<typeof SourceSchema>;

export const OSM_SOURCE: Source = {
  tiles: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
  attribution: "© OpenStreetMap",
};

// GeoJSON simplestyle properties
type LineStringProperties = {
  stroke?: string;
  "stroke-width"?: number;
};
type PolygonProperties = {
  fill?: string;
  "fill-opacity"?: number;
  stroke?: string;
  "stroke-width"?: number;
};
type PointProperties = {
  "marker-color"?: string;
  "marker-size"?: "small" | "large" | number;
};

export type Feature =
  | GeoJSON.Feature<GeoJSON.LineString, LineStringProperties>
  | GeoJSON.Feature<GeoJSON.Polygon, PolygonProperties>
  | GeoJSON.Feature<GeoJSON.Point, PointProperties>;

export type StaticMapOptions = {
  width: number;
  height: number;
  padding?: number; // px inset from edge when auto-fitting features; default 10
  source?: Source; // default: OSM_SOURCE
  zoom?: number; // auto-calculated if omitted
  center?: GeoJSON.Position; // [lng, lat]; auto-calculated from features if omitted
  features?: Feature[];
  retina?: boolean; // render at 2x resolution; output is 2*width x 2*height
  tileProvider?: TileFetcher; // injectable for testing
};

export async function renderStaticMap(opts: StaticMapOptions): Promise<Buffer> {
  await ensureFonts();
  let source: Source;
  if (opts.source) {
    source = opts.source;
  } else {
    source = OSM_SOURCE;
  }
  const tileSize = source.tileSize ?? 256;
  const urlTemplate = source.tiles;
  const attribution = source.attribution;
  const provider = opts.tileProvider ?? fetchTile;
  const { width, height, features = [] } = opts;
  const padding = opts.padding ?? 10;
  const retina = opts.retina ?? false;
  const scale = retina ? 2 : 1;

  // Resolve retina tile URL: replace {r} placeholder with "@2x" or ""
  const resolvedUrlTemplate = urlTemplate.replace("{r}", retina ? "@2x" : "");

  const zoom =
    opts.zoom ?? calculateZoom(features, width, height, tileSize, padding);

  let xCenter: number, yCenter: number;
  if (opts.center) {
    xCenter = lonToX(opts.center[0]!, zoom);
    yCenter = latToY(opts.center[1]!, zoom);
  } else {
    const [minLon, minLat, maxLon, maxLat] = featureExtent(
      features,
      opts.center,
      opts.zoom,
    );
    xCenter = lonToX((minLon + maxLon) / 2, zoom);
    yCenter = latToY((minLat + maxLat) / 2, zoom);
  }

  const canvas = createCanvas(width * scale, height * scale);
  const ctx = canvas.getContext("2d");

  if (retina) ctx.scale(2, 2);

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);

  await drawTiles(
    ctx,
    zoom,
    xCenter,
    yCenter,
    width,
    height,
    tileSize,
    resolvedUrlTemplate,
    provider,
  );
  drawFeatures(ctx, zoom, xCenter, yCenter, width, height, tileSize, features);
  if (attribution) drawAttribution(ctx, width, height, attribution);

  const resolution = retina ? 144 : 72;

  return new Promise((resolve, reject) => {
    canvas.toBuffer(
      (err, buf) => (err ? reject(err) : resolve(buf)),
      "image/png",
      { resolution },
    );
  });
}

async function drawTiles(
  ctx: CanvasRenderingContext2D,
  zoom: number,
  xCenter: number,
  yCenter: number,
  width: number,
  height: number,
  tileSize: number,
  urlTemplate: string,
  provider: TileFetcher,
): Promise<void> {
  const xMin = Math.floor(xCenter - (0.5 * width) / tileSize);
  const yMin = Math.floor(yCenter - (0.5 * height) / tileSize);
  const xMax = Math.ceil(xCenter + (0.5 * width) / tileSize);
  const yMax = Math.ceil(yCenter + (0.5 * height) / tileSize);

  const n = Math.pow(2, zoom);

  const tiles: {
    tileX: number;
    tileY: number;
    dstLeft: number;
    dstTop: number;
  }[] = [];
  for (let x = xMin; x < xMax; x++) {
    for (let y = yMin; y < yMax; y++) {
      const tileX = ((x % n) + n) % n;
      const tileY = ((y % n) + n) % n;
      const dstLeft = Math.round((x - xCenter) * tileSize + width / 2);
      const dstTop = Math.round((y - yCenter) * tileSize + height / 2);
      tiles.push({ tileX, tileY, dstLeft, dstTop });
    }
  }

  await Promise.all(
    tiles.map(async ({ tileX, tileY, dstLeft, dstTop }) => {
      const buf = await provider(urlTemplate, zoom, tileX, tileY);
      if (!buf) return;
      const img = await loadImage(buf);
      ctx.drawImage(img, dstLeft, dstTop, tileSize, tileSize);
    }),
  );
}

function drawFeatures(
  ctx: CanvasRenderingContext2D,
  zoom: number,
  xCenter: number,
  yCenter: number,
  width: number,
  height: number,
  tileSize: number,
  features: Feature[],
): void {
  const toPx = (pos: GeoJSON.Position): [number, number] => [
    xToPx(lonToX(pos[0]!, zoom), xCenter, width, tileSize),
    yToPx(latToY(pos[1]!, zoom), yCenter, height, tileSize),
  ];

  for (const f of features) {
    if (f.geometry.type === "Polygon") {
      const p =
        (f as GeoJSON.Feature<GeoJSON.Polygon, PolygonProperties>).properties ??
        {};
      const fill = p.fill ?? "#555555";
      const fillOpacity = p["fill-opacity"] ?? 0.6;
      const stroke = p.stroke ?? "#555555";
      const strokeWidth = p["stroke-width"] ?? 2;
      const coords = f.geometry.coordinates[0]!;

      ctx.beginPath();
      const [startX, startY] = toPx(coords[0]!);
      ctx.moveTo(startX, startY);
      for (let i = 1; i < coords.length; i++) {
        const [px, py] = toPx(coords[i]!);
        ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.globalAlpha = fillOpacity;
      ctx.fillStyle = fill;
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.strokeStyle = stroke;
      ctx.lineWidth = strokeWidth;
      ctx.stroke();
    } else if (f.geometry.type === "LineString") {
      const p =
        (f as GeoJSON.Feature<GeoJSON.LineString, LineStringProperties>)
          .properties ?? {};
      const stroke = p.stroke ?? "#555555";
      const strokeWidth = p["stroke-width"] ?? 2;
      const coords = f.geometry.coordinates;

      ctx.beginPath();
      const [startX, startY] = toPx(coords[0]!);
      ctx.moveTo(startX, startY);
      for (let i = 1; i < coords.length; i++) {
        const [px, py] = toPx(coords[i]!);
        ctx.lineTo(px, py);
      }
      ctx.strokeStyle = stroke;
      ctx.lineWidth = strokeWidth;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.stroke();
    } else if (f.geometry.type === "Point") {
      const p =
        (f as GeoJSON.Feature<GeoJSON.Point, PointProperties>).properties ?? {};
      const color = p["marker-color"] ?? "#7e7e7e";
      const size = p["marker-size"];
      const r =
        size === "small"
          ? 4
          : size === "large"
            ? 10
            : typeof size === "number"
              ? size
              : 7;
      const [cx, cy] = toPx(f.geometry.coordinates);

      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
    }
  }
}

function drawAttribution(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  attribution: string,
): void {
  const padX = 4;
  const padY = 2;

  ctx.antialias = "subpixel";
  ctx.font = `300 10px "Source Sans 3"`;
  ctx.textBaseline = "alphabetic";
  const metrics = ctx.measureText(attribution);
  const textW = metrics.width;
  const textH =
    metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent;
  const boxW = textW + padX * 2;
  const boxH = textH + padY * 2;
  const boxX = width - boxW;
  const boxY = height - boxH;

  ctx.fillStyle = "#f2f2f2";
  ctx.beginPath();
  ctx.roundRect(boxX, boxY, boxW, boxH, [2, 0, 0, 0]);
  ctx.fill();

  ctx.fillStyle = "#1f1f1f";
  ctx.fillText(
    attribution,
    boxX + padX,
    boxY + padY + metrics.actualBoundingBoxAscent + 0.5,
  );
}

function featureExtent(
  features: Feature[],
  center: GeoJSON.Position | undefined,
  zoom: number | undefined,
): [number, number, number, number] {
  const lons: number[] = [];
  const lats: number[] = [];

  for (const f of features) {
    if (f.geometry.type === "Point") {
      lons.push(f.geometry.coordinates[0]!);
      lats.push(f.geometry.coordinates[1]!);
    } else if (f.geometry.type === "LineString") {
      for (const pos of f.geometry.coordinates) {
        lons.push(pos[0]!);
        lats.push(pos[1]!);
      }
    } else {
      // Polygon — use outer ring
      for (const pos of f.geometry.coordinates[0]!) {
        lons.push(pos[0]!);
        lats.push(pos[1]!);
      }
    }
  }

  if (lons.length === 0) {
    if (!center || zoom === undefined) {
      throw new Error(
        "cannot render empty map: no features and no explicit center+zoom",
      );
    }
    return [center[0]!, center[1]!, center[0]!, center[1]!];
  }

  return [
    Math.min(...lons),
    Math.min(...lats),
    Math.max(...lons),
    Math.max(...lats),
  ];
}

function calculateZoom(
  features: Feature[],
  width: number,
  height: number,
  tileSize: number,
  padding: number,
): number {
  const extent = featureExtent(features, undefined, undefined);
  const [minLon, minLat, maxLon, maxLat] = extent;
  const availW = width - padding * 2;
  const availH = height - padding * 2;

  for (let z = 17; z >= 0; z--) {
    const pxWidth = (lonToX(maxLon, z) - lonToX(minLon, z)) * tileSize;
    if (pxWidth > availW) continue;

    const pxHeight = (latToY(minLat, z) - latToY(maxLat, z)) * tileSize;
    if (pxHeight > availH) continue;

    return z;
  }
  return 0;
}

// Coordinate math (Web Mercator)

function lonToX(lon: number, zoom: number): number {
  if (lon < -180 || lon > 180) lon = ((lon + 180) % 360) - 180;
  return ((lon + 180) / 360) * Math.pow(2, zoom);
}

function latToY(lat: number, zoom: number): number {
  if (lat < -90 || lat > 90) lat = ((lat + 90) % 180) - 90;
  const latRad = (lat * Math.PI) / 180;
  return (
    ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) *
    Math.pow(2, zoom)
  );
}

function xToPx(
  x: number,
  xCenter: number,
  width: number,
  tileSize: number,
): number {
  return (x - xCenter) * tileSize + width / 2;
}

function yToPx(
  y: number,
  yCenter: number,
  height: number,
  tileSize: number,
): number {
  return (y - yCenter) * tileSize + height / 2;
}

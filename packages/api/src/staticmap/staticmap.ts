// Based on <https://github.com/komoot/staticmap/>
import type GeoJSON from "geojson";
import sharp from "sharp";

import { type TileFetcher, fetchTile } from "../tile-cache.js";

export type RasterSource = {
  tiles: [string, ...string[]];
  tileSize?: number; // default 512 (matches MapLibre default); OSM uses 256
};

export const OSM_SOURCE: RasterSource = {
  tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
  tileSize: 256,
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
  source?: RasterSource; // default: OSM_SOURCE
  zoom?: number; // auto-calculated if omitted
  center?: GeoJSON.Position; // [lng, lat]; auto-calculated from features if omitted
  features?: Feature[];
  tileProvider?: TileFetcher; // injectable for testing
};

export async function renderStaticMap(opts: StaticMapOptions): Promise<Buffer> {
  const source = opts.source ?? OSM_SOURCE;
  const tileSize = source.tileSize ?? 512;
  const urlTemplate = source.tiles[0];
  const provider = opts.tileProvider ?? fetchTile;
  const { width, height, features = [] } = opts;
  const padding = opts.padding ?? 10;

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

  const tileComposites = await buildTileLayer(
    zoom,
    xCenter,
    yCenter,
    width,
    height,
    tileSize,
    urlTemplate,
    provider,
  );

  const svgBuf = buildFeaturesSvg(
    zoom,
    xCenter,
    yCenter,
    width,
    height,
    tileSize,
    features,
  );

  const composites: sharp.OverlayOptions[] = [
    ...tileComposites,
    { input: svgBuf, top: 0, left: 0 },
  ];

  return sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 255, g: 255, b: 255 },
    },
  })
    .composite(composites)
    .png()
    .toBuffer();
}

async function buildTileLayer(
  zoom: number,
  xCenter: number,
  yCenter: number,
  width: number,
  height: number,
  tileSize: number,
  urlTemplate: string,
  provider: TileFetcher,
): Promise<sharp.OverlayOptions[]> {
  const xMin = Math.floor(xCenter - (0.5 * width) / tileSize);
  const yMin = Math.floor(yCenter - (0.5 * height) / tileSize);
  const xMax = Math.ceil(xCenter + (0.5 * width) / tileSize);
  const yMax = Math.ceil(yCenter + (0.5 * height) / tileSize);

  const n = Math.pow(2, zoom);

  const tileMap = new Map<
    string,
    { tileX: number; tileY: number; canvasLeft: number; canvasTop: number }
  >();
  for (let x = xMin; x < xMax; x++) {
    for (let y = yMin; y < yMax; y++) {
      const tileX = ((x % n) + n) % n;
      const tileY = ((y % n) + n) % n;
      const canvasLeft = Math.round((x - xCenter) * tileSize + width / 2);
      const canvasTop = Math.round((y - yCenter) * tileSize + height / 2);
      tileMap.set(`${x}/${y}`, { tileX, tileY, canvasLeft, canvasTop });
    }
  }

  const entries = await Promise.all(
    Array.from(tileMap.entries()).map(
      async ([, { tileX, tileY, canvasLeft, canvasTop }]) => {
        const buf = await provider(urlTemplate, zoom, tileX, tileY);
        if (!buf) return null;

        const srcLeft = Math.max(0, -canvasLeft);
        const srcTop = Math.max(0, -canvasTop);
        const dstLeft = Math.max(0, canvasLeft);
        const dstTop = Math.max(0, canvasTop);
        const visW = Math.min(tileSize - srcLeft, width - dstLeft);
        const visH = Math.min(tileSize - srcTop, height - dstTop);

        if (visW <= 0 || visH <= 0) return null;

        // Always extract to the visible rectangle — sharp requires composite
        // inputs to be no larger than the canvas in either dimension.
        let input: Buffer;
        if (srcLeft > 0 || srcTop > 0 || visW < tileSize || visH < tileSize) {
          input = await sharp(buf)
            .extract({ left: srcLeft, top: srcTop, width: visW, height: visH })
            .toBuffer();
        } else {
          input = buf;
        }

        return { input, top: dstTop, left: dstLeft };
      },
    ),
  );

  return entries.filter(
    (e): e is NonNullable<typeof e> => e !== null,
  ) satisfies sharp.OverlayOptions[];
}

function buildFeaturesSvg(
  zoom: number,
  xCenter: number,
  yCenter: number,
  width: number,
  height: number,
  tileSize: number,
  features: Feature[],
): Buffer {
  const toPx = (pos: GeoJSON.Position): [number, number] => [
    xToPx(lonToX(pos[0]!, zoom), xCenter, width, tileSize),
    yToPx(latToY(pos[1]!, zoom), yCenter, height, tileSize),
  ];

  const pts = (coords: GeoJSON.Position[]) =>
    coords
      .map(c =>
        toPx(c)
          .map(v => v.toFixed(2))
          .join(","),
      )
      .join(" ");

  const sanitize = (s: string) => String(s).replace(/[<>"'&]/g, "");

  const polygons = features.filter(
    (f): f is GeoJSON.Feature<GeoJSON.Polygon, PolygonProperties> =>
      f.geometry.type === "Polygon",
  );
  const lines = features.filter(
    (f): f is GeoJSON.Feature<GeoJSON.LineString, LineStringProperties> =>
      f.geometry.type === "LineString",
  );
  const points = features.filter(
    (f): f is GeoJSON.Feature<GeoJSON.Point, PointProperties> =>
      f.geometry.type === "Point",
  );

  const polygonSvg = polygons
    .map(f => {
      const p = f.properties ?? {};
      const fill = sanitize(p.fill ?? "#555555");
      const fillOpacity = p["fill-opacity"] ?? 0.6;
      const stroke = sanitize(p.stroke ?? "#555555");
      const strokeWidth = p["stroke-width"] ?? 2;
      return `<polygon points="${pts(f.geometry.coordinates[0]!)}" fill="${fill}" fill-opacity="${fillOpacity}" stroke="${stroke}" stroke-width="${strokeWidth}"/>`;
    })
    .join("\n  ");

  const lineSvg = lines
    .map(f => {
      const p = f.properties ?? {};
      const stroke = sanitize(p.stroke ?? "#555555");
      const strokeWidth = p["stroke-width"] ?? 2;
      return `<polyline points="${pts(f.geometry.coordinates)}" stroke="${stroke}" stroke-width="${strokeWidth}" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`;
    })
    .join("\n  ");

  const pointSvg = points
    .map(f => {
      const p = f.properties ?? {};
      const color = sanitize(p["marker-color"] ?? "#7e7e7e");
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
      return `<circle cx="${cx.toFixed(2)}" cy="${cy.toFixed(2)}" r="${r}" fill="${color}"/>`;
    })
    .join("\n  ");

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
  ${polygonSvg}
  ${lineSvg}
  ${pointSvg}
</svg>`;

  return Buffer.from(svg);
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

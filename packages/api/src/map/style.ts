import type ml from "maplibre-gl";

import {
  type AppStyle,
  type AppStyleMeta,
  StyleMetadataFieldSchema,
  insertLayers,
} from "@pt/shared";

export type FullCatalog = {
  styles: Record<string, AppStyle>;
  overlays: Record<string, AppStyle>;
};

// prettier-ignore
export const defaultDEMSource: ml.RasterDEMSourceSpecification =
  { type: "raster-dem", tiles: ["https://tiles.mapterhorn.com/{z}/{x}/{y}.webp"], attribution: "<a href='https://mapterhorn.com/attribution'>© Mapterhorn</a>", maxzoom: 12, bounds: [-180, -85.0511287, 180, 85.0511287], encoding: "terrarium", tileSize: 512} as const;

// prettier-ignore
export const eduDEMSource: ml.RasterDEMSourceSpecification =
  { type: "raster-dem", tiles: ["https://tile.plantopo.com/edu.os-terrain-5-rgb/{z}/{x}/{y}"], bounds: [-9.24941, 49.85961, 2.781412, 60.907668], maxzoom: 14, minzoom: 6, encoding: "mapbox", attribution: '© Crown copyright and database rights 2026 Ordnance Survey (AC0000851941) <a href="https://digimap.edina.ac.uk/help/copyright-and-licensing/ngd_eula/" target="_blank">For educational use only</a>'} as const;

// prettier-ignore
const SIMPLE_STYLE_LAYERS: ml.LayerSpecification[] = [
  {
    id: "plantopo:geojson-fill", type: "fill", source: "plantopo:geojson", filter: ["==", ["geometry-type"], "Polygon"],
    paint: {
      "fill-color": ["coalesce", ["get", "fill"], "#555555"],
      "fill-opacity": ["case", ["has", "fill-opacity"], ["to-number", ["get", "fill-opacity"]], 0.6],
    },
  },
  {
    id: "plantopo:geojson-fill-outline", type: "line", source: "plantopo:geojson", filter: ["==", ["geometry-type"], "Polygon"],
    paint: {
      "line-color": ["coalesce", ["get", "stroke"], "#555555"],
      "line-opacity": ["case", ["has", "stroke-opacity"], ["to-number", ["get", "stroke-opacity"]], 1],
      "line-width": [ "case", ["has", "stroke-width"], ["to-number", ["get", "stroke-width"]], 2],
    },
  },
  {
    id: "plantopo:geojson-line", type: "line", source: "plantopo:geojson", filter: ["==", ["geometry-type"], "LineString"],
    paint: {
      "line-color": ["coalesce", ["get", "stroke"], "#555555"],
      "line-opacity": ["case", ["has", "stroke-opacity"], ["to-number", ["get", "stroke-opacity"]], 1],
      "line-width": ["case", ["has", "stroke-width"], ["to-number", ["get", "stroke-width"]], 2],
    },
  },
  {
    id: "plantopo:geojson-point", type: "circle", source: "plantopo:geojson", filter: ["==", ["geometry-type"], "Point"],
    paint: {
      "circle-color": ["coalesce", ["get", "marker-color"], "#7e7e7e"],
      "circle-radius": [ "match", ["get", "marker-size"], "small", 4, "large", 10, 7],
      "circle-stroke-color": "#ffffff",
      "circle-stroke-width": 1.5,
    },
  },
];

export function buildFullStyleCatalog(
  bases: Record<string, ml.StyleSpecification>,
  overlayBases: Record<string, ml.StyleSpecification>,
): FullCatalog {
  return {
    styles: Object.fromEntries(
      Object.entries(bases).map(([id, base]) => [id, prepareStyle(id, base)]),
    ),
    overlays: Object.fromEntries(
      Object.entries(overlayBases).map(([id, base]) => [
        id,
        prepareOverlay(id, base),
      ]),
    ),
  };
}

export function customizeStyleCatalog(
  fullCatalog: FullCatalog,
  accessScopes: string[],
  tileKey: string | undefined,
): FullCatalog {
  const customize = (record: Record<string, AppStyle>) =>
    Object.fromEntries(
      Object.entries(record)
        .filter(([_, base]) => styleHasAccess(base, accessScopes))
        .map(([id, base]) => [id, customizeStyle(base, accessScopes, tileKey)]),
    );
  return {
    styles: customize(fullCatalog.styles),
    overlays: customize(fullCatalog.overlays),
  };
}

export function stylesToMeta(
  styles: Record<string, AppStyle>,
): Record<string, AppStyleMeta> {
  return Object.fromEntries(
    Object.entries(styles).map(([id, style]) => [id, styleToMeta(style)]),
  );
}

function styleToMeta(style: AppStyle): AppStyleMeta {
  const { layers: _layers, sources: _sources, ...meta } = style;
  return meta;
}

function prepareOverlay(id: string, base: ml.StyleSpecification): AppStyle {
  return {
    ...base,
    id,
    metadata: StyleMetadataFieldSchema.parse(base.metadata),
    sources: {
      ...base.sources,
      ...demSources(),
    },
    layers: base.layers,
  };
}

const SLOT_LAYER: (slot: string) => ml.LayerSpecification = slot => ({
  id: `plantopo:slot-${slot}`,
  type: "background",
  layout: { visibility: "none" },
});

function ensureSlots(layers: ml.LayerSpecification[]): ml.LayerSpecification[] {
  const ids = new Set(layers.map(l => l.id));
  const result = [...layers];
  for (const slot of ["bottom", "middle", "top"] as const) {
    if (!ids.has(`plantopo:slot-${slot}`)) {
      result.push(SLOT_LAYER(slot));
    }
  }
  return result;
}

function prepareStyle(id: string, base: ml.StyleSpecification): AppStyle {
  return {
    ...base,
    id,
    glyphs: "https://tile.plantopo.com/font/{fontstack}/{range}",
    metadata: StyleMetadataFieldSchema.parse(base.metadata),
    sources: {
      ...base.sources,
      ...demSources(),
      "plantopo:geojson": {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      },
    },
    layers: insertLayers(
      ensureSlots(base.layers),
      "middle",
      SIMPLE_STYLE_LAYERS,
    ),
  };
}

function customizeStyle(
  base: AppStyle,
  accessScopes: string[],
  tileKey: string | undefined,
): AppStyle {
  const mayEdu = accessScopes.includes("edu");

  const sources = Object.fromEntries(
    Object.entries({
      ...base.sources,
      ...(mayEdu ? demSources(eduDEMSource) : {}),
    }).map(([id, spec]) => [id, customizeSource(spec, tileKey)]),
  );

  return {
    ...base,
    sources,
  };
}

function customizeSource(
  spec: ml.SourceSpecification,
  tileKey: string | undefined,
): ml.SourceSpecification {
  if ("attribution" in spec && spec.attribution) {
    const currentYear = new Date().getFullYear().toString();
    spec = {
      ...spec,
      attribution: spec.attribution.replace(/\bYEAR\b/, currentYear),
    };
  }

  if (
    "tileSize" in spec &&
    spec.tileSize &&
    typeof spec.tileSize === "string"
  ) {
    // Not part of the tilejson spec, so martin will output it as a string
    const tileSize = parseInt(spec.tileSize);
    if (!isNaN(tileSize)) {
      spec = { ...spec, tileSize };
    }
  }

  if ("tiles" in spec && spec.tiles) {
    const tiles = spec.tiles.map(url => {
      if (tileKey && url.startsWith("https://tile.plantopo.com")) {
        return addParamToTileURL(url, "key", tileKey);
      }
      return url;
    });
    spec = { ...spec, tiles };
  }

  return spec;
}

function addParamToTileURL(url: string, param: string, value: string): string {
  // Note: We skip parsing to easily preserve templates (e.g. {x})
  if (url.includes("?")) {
    return url + `&${param}=${value}`;
  } else {
    return url + `?${param}=${value}`;
  }
}

function styleHasAccess(base: AppStyle, accessScopes: string[]): boolean {
  const scopes = base.metadata["plantopo:accessScopes"] ?? [];
  return scopes.every(s => accessScopes.includes(s));
}

function demSources(
  spec?: ml.RasterDEMSourceSpecification,
): Record<string, ml.RasterDEMSourceSpecification> {
  if (!spec) spec = defaultDEMSource;
  return {
    "plantopo:hillshade-dem": spec,
    "plantopo:terrain-dem": spec,
  };
}

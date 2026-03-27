import { env } from "@/env";
import ml from "maplibre-gl";

import type { MapProps } from "./types";

export function buildStyle(props: MapProps): ml.StyleSpecification {
  return {
    version: 8,
    sources: {
      base: baseStyleSource(props.baseStyle),
      geojson: {
        type: "geojson",
        data: props.geojson ?? { type: "FeatureCollection", features: [] },
      },
    },
    layers: [
      {
        id: "base",
        type: "raster",
        source: "base",
      },
      // Polygons — fill
      {
        id: "geojson-fill",
        type: "fill",
        source: "geojson",
        filter: ["==", ["geometry-type"], "Polygon"],
        paint: {
          "fill-color": ["coalesce", ["get", "fill"], "#555555"],
          "fill-opacity": [
            "case",
            ["has", "fill-opacity"],
            ["to-number", ["get", "fill-opacity"]],
            0.6,
          ],
        },
      },
      // Polygons — stroke
      {
        id: "geojson-fill-outline",
        type: "line",
        source: "geojson",
        filter: ["==", ["geometry-type"], "Polygon"],
        paint: {
          "line-color": ["coalesce", ["get", "stroke"], "#555555"],
          "line-opacity": [
            "case",
            ["has", "stroke-opacity"],
            ["to-number", ["get", "stroke-opacity"]],
            1,
          ],
          "line-width": [
            "case",
            ["has", "stroke-width"],
            ["to-number", ["get", "stroke-width"]],
            2,
          ],
        },
      },
      // Lines
      {
        id: "geojson-line",
        type: "line",
        source: "geojson",
        filter: ["==", ["geometry-type"], "LineString"],
        paint: {
          "line-color": ["coalesce", ["get", "stroke"], "#555555"],
          "line-opacity": [
            "case",
            ["has", "stroke-opacity"],
            ["to-number", ["get", "stroke-opacity"]],
            1,
          ],
          "line-width": [
            "case",
            ["has", "stroke-width"],
            ["to-number", ["get", "stroke-width"]],
            2,
          ],
        },
      },
      // Points — circle (marker-color, no symbol support)
      {
        id: "geojson-point",
        type: "circle",
        source: "geojson",
        filter: ["==", ["geometry-type"], "Point"],
        paint: {
          "circle-color": ["coalesce", ["get", "marker-color"], "#7e7e7e"],
          "circle-radius": [
            "match",
            ["get", "marker-size"],
            "small",
            4,
            "large",
            10,
            7, // medium (default)
          ],
          "circle-stroke-color": "#ffffff",
          "circle-stroke-width": 1.5,
        },
      },
    ],
  };
}

function baseStyleSource(
  optionalBaseStyle: MapProps["baseStyle"],
): ml.RasterSourceSpecification {
  const baseStyle = optionalBaseStyle ?? "thunderforest";
  if (typeof baseStyle === "string") {
    switch (baseStyle) {
      case "thunderforest": {
        return {
          type: "raster",
          tiles: [
            `https://api.thunderforest.com/outdoors/{z}/{x}/{y}.png?apikey=${env.VITE_THUNDERFOREST_TILE_KEY}`,
          ],
          tileSize: 256,
          minzoom: 0,
          maxzoom: 22,
          attribution:
            '<a href="https://www.thunderforest.com/" target="_blank">&copy; Thunderforest</a> <a href="https://www.openstreetmap.org/copyright" target="_blank">&copy; OpenStreetMap contributors</a>',
        };
      }
      case "os": {
        return {
          type: "raster",
          url: "https://tiles.plantopo.com/tilejson/os_leisure.json",
        };
      }
      case "satellite": {
        return {
          type: "raster",
          tiles: [
            "https://mt2.google.com/vt/lyrs=s&x={x}&y={y}&z={z}",
            "https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}",
            "https://mt3.google.com/vt/lyrs=s&x={x}&y={y}&z={z}",
          ],
          tileSize: 256,
          minzoom: 0,
          maxzoom: 21,
          attribution: "Map data &copy; Google",
        };
      }
    }
  } else {
    return baseStyle;
  }
}

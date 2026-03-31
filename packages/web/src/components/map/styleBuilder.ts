import ml from "maplibre-gl";

import {
  OS_SOURCE,
  RASTER_BASE_LAYER,
  SATELLITE_SOURCE,
  SIMPLE_STYLE_LAYER_SPECS,
  THUNDERFOREST_SOURCE,
} from "./style";
import type { MapProps } from "./types";

export function buildStyle(props: MapProps): ml.StyleSpecification {
  return {
    version: 8,
    sources: {
      base: baseStyleSource(props.baseStyle),
      geojson: buildGeojsonSource(props.geojson),
    },
    layers: [RASTER_BASE_LAYER, ...SIMPLE_STYLE_LAYER_SPECS],
  };
}

function buildGeojsonSource(
  geojson: MapProps["geojson"],
): ml.GeoJSONSourceSpecification {
  if (!geojson) {
    return {
      type: "geojson",
      data: { type: "FeatureCollection", features: [] },
    };
  } else if (geojson.type === "FeatureCollection") {
    return {
      type: "geojson",
      data: geojson,
    };
  } else {
    return {
      type: "geojson",
      data: {
        type: "FeatureCollection",
        features: [geojson],
      },
    };
  }
}

function baseStyleSource(
  optionalBaseStyle: MapProps["baseStyle"],
): ml.RasterSourceSpecification {
  const baseStyle = optionalBaseStyle ?? "thunderforest";
  if (typeof baseStyle === "string") {
    // prettier-ignore
    switch (baseStyle) {
      case "thunderforest": return THUNDERFOREST_SOURCE;
      case "os": return OS_SOURCE;
      case "satellite": return SATELLITE_SOURCE;
    }
  } else {
    return baseStyle;
  }
}

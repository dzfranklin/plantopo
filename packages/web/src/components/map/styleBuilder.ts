import ml from "maplibre-gl";

import {
  OS_SOURCE,
  RASTER_BASE_LAYER,
  SATELLITE_SOURCE,
  SIMPLE_STYLE_LAYER_SPECS,
  THUNDERFOREST_SOURCE,
} from "./style";
import type { BuiltinBaseStyle, MapProps } from "./types";

const BUILTIN_SOURCES: Record<BuiltinBaseStyle, ml.RasterSourceSpecification> =
  {
    thunderforest: THUNDERFOREST_SOURCE,
    os: OS_SOURCE,
    satellite: SATELLITE_SOURCE,
  };

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
    return BUILTIN_SOURCES[baseStyle];
  } else {
    return baseStyle;
  }
}

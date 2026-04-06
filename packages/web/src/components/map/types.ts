import z from "zod";

import { CustomBaseStyleSchema } from "@pt/shared";

import type { MapManager } from "./MapManager";

export interface MapProps {
  interactive?: boolean;
  hash?: boolean | string;
  baseStyle?: z.infer<typeof BaseStyleSchema>;
  distanceUnit?: "km" | "mi";
  /** GeoJSON data to display on the map.
   * Supports [simplestyle](https://github.com/mapbox/simplestyle-spec/tree/master/1.1.0). */
  geojson?: GeoJSON.FeatureCollection | GeoJSON.Feature | null;
  tileKey?: string;
  onManager?: (manager: MapManager) => void;
  onShowAttributions?: (html: string) => void;
  triggerGeolocationControl?: boolean;
}

export const BuiltinBaseStyleSchema = z.enum([
  "thunderforest",
  "os",
  "satellite",
]);

export type BuiltinBaseStyle = z.infer<typeof BuiltinBaseStyleSchema>;

export const BUILTIN_STYLE_META: Record<
  BuiltinBaseStyle,
  { label: string; thumbnail: string }
> = {
  thunderforest: {
    label: "Thunderforest",
    thumbnail: "/layer-thunderforest-thumbnail.png",
  },
  os: { label: "OS", thumbnail: "/layer-os-thumbnail.png" },
  satellite: {
    label: "Satellite",
    thumbnail: "/layer-satellite-thumbnail.png",
  },
};

export const BaseStyleSchema = z.union([
  BuiltinBaseStyleSchema,
  CustomBaseStyleSchema,
]);

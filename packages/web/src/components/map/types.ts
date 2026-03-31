import z from "zod";

import type { MapManager } from "./MapManager";

export interface MapProps {
  interactive?: boolean;
  hash?: boolean | string;
  baseStyle?: z.infer<typeof BaseStyleSchema>;
  /** GeoJSON data to display on the map.
   * Supports [simplestyle](https://github.com/mapbox/simplestyle-spec/tree/master/1.1.0). */
  geojson?: GeoJSON.FeatureCollection | GeoJSON.Feature | null;
  onManager?: (manager: MapManager) => void;
  onShowAttributions?: (html: string) => void;
  triggerGeolocationControl?: boolean;
}
const sourceURLSchema = z.string().startsWith("https://");
const boundsSchema = z.tuple([z.number(), z.number(), z.number(), z.number()]);

export const BuiltinBaseStyleSchema = z.enum([
  "thunderforest",
  "os",
  "satellite",
]);

export const CustomBaseStyleSchema = z.object({
  type: z.literal("raster"),
  url: sourceURLSchema.optional(),
  tiles: z.array(sourceURLSchema).nonempty().optional(),
  bounds: boundsSchema.optional(),
  minzoom: z.number().optional(),
  maxzoom: z.number().optional(),
  tileSize: z.number().optional(),
  scheme: z.enum(["xyz", "tms"]).optional(),
  attribution: z.string().optional(),
});

export const BaseStyleSchema = z.union([
  BuiltinBaseStyleSchema,
  CustomBaseStyleSchema,
]);

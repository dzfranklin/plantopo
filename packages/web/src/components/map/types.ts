import type ml from "maplibre-gl";
import z from "zod";

import type { MapManager } from "./MapManager";

export interface MapProps {
  interactive?: boolean;
  hash?: boolean;
  style?: ml.StyleSpecification;
  initialCamera?: ml.CameraOptions | string;
  distanceUnit?: "km" | "mi";
  /** GeoJSON data to display on the map.
   * Supports [simplestyle](https://github.com/mapbox/simplestyle-spec/tree/master/1.1.0). */
  geojson?: GeoJSON.FeatureCollection | GeoJSON.Feature | null;
  onManager?: (manager: MapManager) => void;
  triggerGeolocationControl?: boolean;
  debug?: boolean;
}

export const SelectedLayersSchema = z.object({
  style: z.string().default("default"),
  overlays: z.array(z.string()).default([]),
});

export type SelectedLayers = z.infer<typeof SelectedLayersSchema>;

export const DEFAULT_SELECTED_LAYERS = SelectedLayersSchema.parse({});

import { GeoJSON } from 'geojson';
import type { JSX } from 'react';

export type InspectFn = (f: InspectFeature) => JSX.Element;

export type InspectFeature = GeoJSON.Feature<
  GeoJSON.Geometry,
  { [name: string]: any }
>;

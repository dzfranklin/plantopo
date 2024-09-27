import { GeoJSON } from 'geojson';
import * as ml from 'maplibre-gl';
import { bbox } from '@turf/bbox';

export function fitBoundsFor(geojson: GeoJSON): ml.LngLatBoundsLike {
  const b = bbox(geojson);
  return [b[0], b[1], b[2], b[3]] as [number, number, number, number];
}

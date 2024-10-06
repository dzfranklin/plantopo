import { GeoJSON } from 'geojson';
import * as ml from 'maplibre-gl';
import { bbox } from '@turf/bbox';

export function fitBoundsFor(geojson: GeoJSON): ml.LngLatBoundsLike {
  const b = bbox(geojson);
  return [b[0], b[1], b[2], b[3]];
}

export function mapBBox(map: ml.Map): [number, number, number, number] {
  const b = map.getBounds();
  return [
    Math.min(b.getWest(), b.getEast()),
    Math.min(b.getNorth(), b.getSouth()),
    Math.max(b.getWest(), b.getEast()),
    Math.max(b.getNorth(), b.getSouth()),
  ];
}

export function onceMapLoaded(map: ml.Map, fn: () => void) {
  if (map.isStyleLoaded()) {
    setTimeout(() => fn(), 0);
  } else {
    map.once('load', () => fn());
  }
}

export function queryRenderedFeatures(
  map: ml.Map,
  point: ml.Point,
  slop: number,
  options?: ml.QueryRenderedFeaturesOptions,
) {
  return map.queryRenderedFeatures(
    [
      [point.x - slop, point.y - slop],
      [point.x + slop, point.y + slop],
    ],
    options,
  );
}

import { Geometry } from 'geojson';
import { centroid } from '@turf/centroid';
import distance from '@turf/distance';

export function centroidOf(g: Geometry): [number, number] {
  return centroid(g).geometry.coordinates as [number, number];
}

export function metersBetween(
  a: [number, number],
  b: [number, number],
): number {
  return distance(a, b, { units: 'meters' });
}

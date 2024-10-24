import { Geometry, LineString, Position } from 'geojson';
import { centroid } from '@turf/centroid';
import distance from '@turf/distance';
import { length } from '@turf/length';
import { feature } from '@turf/helpers';
import { bbox } from '@turf/bbox';

export function centroidOf(g: Geometry): [number, number] {
  return centroid(g).geometry.coordinates as [number, number];
}

export function metersBetween(a: Position, b: Position): number {
  return distance(a, b, { units: 'meters' });
}

export function lineStringGeometry(coordinates: Position[]): LineString {
  return { type: 'LineString', coordinates };
}

export function lengthOf(g: Geometry): number {
  return length(feature(g), { units: 'meters' });
}

export function bboxOf(g: Geometry): [number, number, number, number] {
  const out = bbox(feature(g));
  if (out.length === 4) {
    return out;
  } else {
    return out.slice(0, 4) as [number, number, number, number];
  }
}

export function bboxIntersects(
  [aMinX, aMinY, aMaxX, aMaxY]: readonly [number, number, number, number],
  [bMinX, bMinY, bMaxX, bMaxY]: readonly [number, number, number, number],
): boolean {
  return bMaxX >= aMinX && bMinX <= aMaxX && bMaxY >= aMinY && bMinY <= aMaxY;
}

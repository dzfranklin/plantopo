import { Geometry } from 'geojson';
import { centroid } from '@turf/centroid';

export function centroidOf(g: Geometry): [number, number] {
  return centroid(g).geometry.coordinates as [number, number];
}

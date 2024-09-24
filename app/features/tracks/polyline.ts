import mlPolyline from '@mapbox/polyline';

export function encodePolyline(points: [number, number][]): string {
  return mlPolyline.encode(flipCoordinateOrder(points));
}

export function decodePolyline(line: string): [number, number][] {
  return flipCoordinateOrder(mlPolyline.decode(line));
}

export function flipCoordinateOrder(
  points: [number, number][],
): [number, number][] {
  return points.map(([a, b]) => [b, a]);
}

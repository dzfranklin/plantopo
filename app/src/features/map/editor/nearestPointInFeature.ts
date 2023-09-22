import { nearestPointOnLine } from '@turf/turf';
import { SyncGeometry } from './api/sync_schema';

export function nearestPointInGeometry(
  target: GeoJSON.Position,
  geom: SyncGeometry,
): GeoJSON.Position {
  switch (geom.type) {
    case 'Point':
      return geom.coordinates;
    case 'LineString':
      return nearestPointOnLine(geom, target).geometry.coordinates;
    default:
      throw new Error(
        `nearestPointInGeometry unimplemented for  ${geom['type']}`,
      );
  }
}

import { nearestPointOnLine } from '@turf/turf';
import { FGeometry } from './api/propTypes';

export function nearestPointInGeometry(
  target: GeoJSON.Position,
  geom: FGeometry,
): GeoJSON.Position {
  switch (geom.type) {
    case 'Point': {
      return geom.coordinates;
    }
    case 'LineString':
    case 'MultiLineString': {
      return nearestPointOnLine(geom, target).geometry.coordinates;
    }
    default:
      throw new Error(`nearestPointInGeometry unimplemented for  ${geom.type}`);
  }
}

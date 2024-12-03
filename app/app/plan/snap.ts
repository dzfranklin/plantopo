import { ControlPoint, ResolvedSnapOutgoing } from '@/app/plan/state';
import { HighwayGraph } from '@/features/map/snap/HighwayGraph';

const maxSnapDistance = 20_000;

export function resolveSnap(
  highways: HighwayGraph,
  before: ControlPoint,
  point: ControlPoint,
  after: ControlPoint,
): { fromBefore?: ResolvedSnapOutgoing; fromPoint?: ResolvedSnapOutgoing } {
  const fromBefore = highways.findPath(
    before.lngLat,
    point.lngLat,
    maxSnapDistance,
  );
  const fromPoint = highways.findPath(
    point.lngLat,
    after.lngLat,
    maxSnapDistance,
  );
  return {
    fromBefore: fromBefore
      ? { toLngLat: point.lngLat, lineString: fromBefore }
      : undefined,
    fromPoint: fromPoint
      ? { toLngLat: after.lngLat, lineString: fromPoint }
      : undefined,
  };
}

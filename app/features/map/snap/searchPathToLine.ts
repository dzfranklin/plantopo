import { HighwaySegment } from '@/features/map/snap/HighwayGraph';
import { LineString, Position } from 'geojson';
import nearestPointOnLine from '@turf/nearest-point-on-line';
import { lineStringGeometry } from '@/geo';

export function searchPathToLine(
  start: Position,
  goal: Position,
  goalSeg: HighwaySegment,
  segs: HighwaySegment[],
): LineString {
  if (segs.length === 0) {
    return lineStringGeometry([]);
  }

  const path: Position[] = [];

  if (segs.length === 1) {
    const onStart = nearestPointOnLine(segs[0]!.feature, start);
    path.push(start);

    const endPoint = nearestPointOnLine(segs[0]!.feature, goal);
    if (endPoint.properties.index >= onStart.properties.index) {
      path.push(
        onStart.geometry.coordinates,
        ...segs[0]!.geometry.coordinates.slice(
          onStart.properties.index + 1,
          endPoint.properties.index + 1,
        ),
        endPoint.geometry.coordinates,
      );
    } else {
      path.push(
        onStart.geometry.coordinates,
        ...segs[0]!.geometry.coordinates
          .slice(endPoint.properties.index + 1, onStart.properties.index + 1)
          .reverse(),
        endPoint.geometry.coordinates,
      );
    }
  } else {
    const onStart = nearestPointOnLine(segs[0]!.feature, start);
    path.push(start, onStart.geometry.coordinates);

    if (segs[0]!.end === segs[1]!.start || segs[0]!.end === segs[1]!.end) {
      path.push(
        ...segs[0]!.geometry.coordinates.slice(onStart.properties.index + 1),
      );
    } else {
      path.push(
        ...segs[0]!.geometry.coordinates
          .slice(0, onStart.properties.index + 1)
          .reverse(),
      );
    }

    for (let i = 1; i < segs.length - 1; i++) {
      const curr = segs[i]!;
      const next = segs[i + 1]!;
      const isFwd = curr.end === next.start || curr.end === next.end;
      if (isFwd) {
        path.push(...curr.geometry.coordinates);
      } else {
        path.push(...curr.geometry.coordinates.toReversed());
      }
    }

    const secondLastSeg = segs.at(-2)!;
    const lastSeg = segs.at(-1)!;
    const isFwd =
      lastSeg.start === secondLastSeg.start ||
      lastSeg.start === secondLastSeg.end;

    const segCoords = lastSeg.geometry.coordinates;
    if (lastSeg === goalSeg) {
      const onGoal = nearestPointOnLine(goalSeg.feature, goal);
      if (isFwd) {
        path.push(...segCoords.slice(0, onGoal.properties.index + 1));
      } else {
        path.push(...segCoords.slice(onGoal.properties.index + 1).reverse());
      }
      path.push(onGoal.geometry.coordinates);
    } else {
      if (isFwd) {
        path.push(...segCoords);
      } else {
        path.push(...segCoords.toReversed());
      }
    }
  }

  return lineStringGeometry(path);
}

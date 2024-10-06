// Inspired by ngraph.path by anvaka (MIT license) <https://github.com/anvaka/ngraph.path>

import { HighwayGraph, HighwaySegment } from '@/features/map/snap/HighwayGraph';
import OpenSet from '@/OpenSet';
import DefaultMap from '@/DefaultMap';

export function aStarPathSearch(
  graph: HighwayGraph,
  start: HighwaySegment,
  goal: HighwaySegment,
  maxMeters?: number,
): HighwaySegment[] | null {
  const cameFrom = new Map<number, HighwaySegment>();

  const gScore = new DefaultMap<number, number>(Infinity);
  gScore.set(start.id, 0);

  const fScore = new DefaultMap<number, number>(Infinity);
  fScore.set(start.id, heuristic(start, goal));

  const openSet = new OpenSet(fScore);
  openSet.push(start);

  while (openSet.size > 0) {
    const current = openSet.pop()!;
    const currentG = gScore.get(current.id);

    if (current === goal || (maxMeters !== undefined && currentG > maxMeters)) {
      return reconstructPath(cameFrom, current);
    }

    for (const neighborID of graph.links.get(current.id) ?? []) {
      const neighbor = graph.segments.get(neighborID);
      if (!neighbor) continue;

      const tentativeG = currentG + current.meters;

      if (tentativeG < gScore.get(neighborID)) {
        cameFrom.set(neighborID, current);

        gScore.set(neighborID, tentativeG);

        const neighborFScore = tentativeG + heuristic(neighbor, goal);
        fScore.set(neighborID, neighborFScore);

        if (!openSet.has(neighbor)) {
          openSet.push(neighbor);
        }
      }
    }
  }

  return null;
}

function reconstructPath(
  cameFrom: Map<number, HighwaySegment>,
  current: HighwaySegment,
): HighwaySegment[] {
  const totalPath = [current];
  while (cameFrom.has(current.id)) {
    current = cameFrom.get(current.id)!;
    totalPath.push(current);
  }
  return totalPath.reverse();
}

function heuristic(node: HighwaySegment, goal: HighwaySegment): number {
  const nodeLng = (node.bbox[0] + node.bbox[2]) / 2;
  const nodeLat = (node.bbox[1] + node.bbox[3]) / 2;
  const goalLng = (goal.bbox[0] + goal.bbox[2]) / 2;
  const goalLat = (goal.bbox[1] + goal.bbox[3]) / 2;

  // on a long search the getCoordinate method call in turf.js's distance function takes around 15% of the total time,
  // so I've inlined the haversine formula. Credit <https://www.movable-type.co.uk/scripts/latlong.html> (MIT license)

  const R = 6371e3; // metres
  const φ1 = (nodeLat * Math.PI) / 180; // φ, λ in radians
  const φ2 = (goalLat * Math.PI) / 180;
  const Δφ = ((goalLat - nodeLat) * Math.PI) / 180;
  const Δλ = ((goalLng - nodeLng) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  // in metres
  return R * c;
}

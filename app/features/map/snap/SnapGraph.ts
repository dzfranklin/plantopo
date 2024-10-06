import RBush from 'rbush';
import { bbox as computeBBox } from '@turf/bbox';
import { Feature, LineString, Position } from 'geojson';
import { bboxOf, lineStringGeometry, metersBetween } from '@/geo';
import { unreachable } from '@/errors';
import * as ml from 'maplibre-gl';
import nearestPointOnLine from '@turf/nearest-point-on-line';
import pointToLineDistance from '@turf/point-to-line-distance';

/*
In OSM an intersection is represented by a node shared between both ways.
Without that it would be e.g. an underpass.

MapTiler's basemap has the same property sometimes, especially at high zoom levels.
But not exactly.

Maybe I should consider making separate snap graph tiles offline?
 */

export type GraphInputFeature = Feature & { id: string };

export type Node = GraphInputFeature & {
  geometry: LineString;
  bbox: [number, number, number, number];
};

interface Link {
  a: Node;
  b: Node;
}

let nextNoID = 1;

export class SnapGraph {
  private _rb = new NodeRBush();

  // Links. For a given link a - b this will contain a -> [b] and b -> [a]
  private _l = new Map<Node, Link[]>();

  static fromRenderedFeatures(map: ml.Map) {
    const rendered = map.queryRenderedFeatures({
      filter: [
        'in',
        ['geometry-type'],
        ['literal', ['LineString', 'MultiLineString']],
      ],
    });
    const features: GraphInputFeature[] = [];
    const added = new Set<string>();
    for (const f of rendered) {
      if (f.layer.type !== 'line') continue;

      const s = f.source;
      const sl = f.sourceLayer;

      if (
        (s === 'maptiler_planet' && sl !== 'transportation') ||
        s === 'contours'
      ) {
        continue;
      }

      const idPrefix = s + '/' + sl + '/';
      let id: string;
      if (f.id) {
        id = idPrefix + f.id;
      } else {
        id = idPrefix + '__SnapGraph' + (nextNoID++).toString();
      }

      if (added.has(id)) continue;

      features.push({
        type: 'Feature',
        id,
        bbox: f.geometry.bbox,
        geometry: f.geometry,
        properties: {},
      });
    }
    return new SnapGraph(features);
  }

  constructor(inputFeatures: GraphInputFeature[]) {
    // On a large input around 90% of the time is spent in stage 1.
    const features = this._insertStage0(inputFeatures);
    const nodes = this._insertStage1(features);
    this._rb.load(nodes);
    this._insertStage2(nodes);
  }

  private _insertStage0(inputFeatures: GraphInputFeature[]): Node[] {
    const features: Node[] = [];

    const pushFeature = (f: GraphInputFeature) => {
      if (f.geometry.type !== 'LineString') unreachable();
      if (f.bbox?.length === 4) {
        features.push(f as Node);
      } else {
        features.push({
          ...(f as Node),
          bbox: computeBBox(f) as [number, number, number, number],
        });
      }
    };

    for (const f of inputFeatures) {
      switch (f.geometry.type) {
        case 'LineString':
          pushFeature(f);
          break;
        case 'MultiLineString': {
          const prefix = f.id + '_';
          for (let lineI = 0; lineI < f.geometry.coordinates.length; lineI++) {
            pushFeature({
              ...f,
              id: prefix + lineI.toString(),
              bbox: undefined,
              geometry: lineStringGeometry(f.geometry.coordinates[lineI]!),
            });
          }
          break;
        }
      }
    }

    return features;
  }

  private _insertStage1(features: Node[]): Node[] {
    // Stage 1: Make a list of nodes. If a node intersects with  another nod
    // split the node such that the only intersecting points are the start/end.

    const featureBush = new NodeRBush();
    featureBush.load(features);

    const nodes: Node[] = [];
    for (const f1 of features) {
      if (f1.geometry.type !== 'LineString') unreachable();

      const overlapping = featureBush.overlaps(f1);

      const coords1 = f1.geometry.coordinates;
      const segments: Position[][] = [];
      let offset = 0;
      for (let p1 = 1; p1 < coords1.length - 1; p1++) {
        for (const f2 of overlapping) {
          if (f1 === f2) continue;
          if (f2.geometry.type !== 'LineString') unreachable();
          const coords2 = f2.geometry.coordinates;
          if (containsEqualCoordinate(coords2, coords1[p1]!)) {
            segments.push(coords1.slice(offset, p1 + 1));
            offset = p1;
            break;
          }
        }
      }
      if (offset < coords1.length - 1) {
        segments.push(coords1.slice(offset));
      }

      for (let i = 0; i < segments.length; i++) {
        let segmentF: Node;
        if (segments.length === 1) {
          segmentF = f1;
        } else {
          const geometry = lineStringGeometry(segments[i]!);
          segmentF = {
            ...f1,
            id: `${f1.id}/${i + 1}`,
            geometry,
            bbox: bboxOf(geometry),
          };
        }

        nodes.push(segmentF);
      }
    }

    return nodes;
  }

  private _insertStage2(nodes: Node[]) {
    // Stage 2: Link features with identical start/end

    for (const n1 of nodes) {
      if (n1.geometry.type !== 'LineString') unreachable();
      const n1Start = n1.geometry.coordinates[0]!;
      const n1End = n1.geometry.coordinates.at(-1)!;

      const neighbors = this._rb.overlaps(n1);
      for (const n2 of neighbors) {
        if (n1 === n2) continue;
        if (n2.geometry.type !== 'LineString') unreachable();
        const n2Start = n2.geometry.coordinates[0]!;
        const n2End = n2.geometry.coordinates.at(-1)!;

        if (
          coordinatesEqual(n1Start, n2Start) ||
          coordinatesEqual(n1Start, n2End) ||
          coordinatesEqual(n1End, n2Start) ||
          coordinatesEqual(n1End, n2End)
        ) {
          this._link(n1, n2);
        }
      }
    }
  }

  private _link(a: Node, b: Node) {
    const link: Link = { a, b };

    if (this._l.has(a)) {
      const sibs = this._l.get(a)!;
      if (!sibs.some((sib) => bidirectionalLinkEqual(sib, link))) {
        sibs.push(link);
      }
    } else {
      this._l.set(a, [link]);
    }

    if (this._l.has(b)) {
      const sibs = this._l.get(b)!;
      if (!sibs.some((sib) => bidirectionalLinkEqual(sib, link))) {
        sibs.push(link);
      }
    } else {
      this._l.set(b, [link]);
    }
  }

  search(from: Position, to: Position): LineString | null {
    // 1/3600 is 1 arc-second, or ~20-30m
    const fromSlop = 1 / 3600;
    const toSlop = 2 / 3600;

    const startCandidates = this._rb.overlapsPoint(from, fromSlop);
    let minStart = Infinity;
    let startNode: Node | undefined;
    let startPt: ReturnType<typeof nearestPointOnLine> | undefined;
    for (const candNode of startCandidates) {
      const candPt = nearestPointOnLine(candNode, from);
      const dist = metersBetween(from, candPt.geometry.coordinates);
      if (dist < minStart) {
        minStart = dist;
        startNode = candNode;
        startPt = candPt;
      }
    }

    const endCandidates = this._rb.overlapsPoint(to, toSlop);
    let minEnd = Infinity;
    let endNode: Node | undefined;
    let endPt: ReturnType<typeof nearestPointOnLine> | undefined;
    for (const candNode of endCandidates) {
      const candPt = nearestPointOnLine(candNode, to);
      const dist = metersBetween(to, candPt.geometry.coordinates);
      if (dist < minEnd) {
        minEnd = dist;
        endNode = candNode;
        endPt = candPt;
      }
    }

    if (!startNode || !startPt || !endNode || !endPt) {
      return null;
    }

    if (startNode === endNode) {
      const startIdx = startPt.properties.index;
      const endIdx = endPt.properties.index;

      if (
        coordinatesEqual(
          startPt.geometry.coordinates,
          endPt.geometry.coordinates,
        )
      ) {
        return null;
      }

      const points: Position[] = [];
      points.push(startPt.geometry.coordinates);
      points.push(
        ...startNode.geometry.coordinates.slice(startIdx + 1, endIdx),
      );
      points.push(endPt.geometry.coordinates);
      return lineStringGeometry(points);
    }

    return null;
    // unimplemented(); // TODO:
  }

  reachable(from: Position): Node[] | null {
    const fromCandidates = this._rb.overlapsPoint(from, 1 / 3600);
    let fromNode: Node | undefined;
    let minFrom = Infinity;
    for (const candidate of fromCandidates) {
      const dist = pointToLineDistance(from, candidate);
      if (dist < minFrom) {
        fromNode = candidate;
        minFrom = dist;
      }
    }
    if (!fromNode) return null;

    const seen = new Set<Node>();
    this._recurseReachable(fromNode, seen);
    return Array.from(seen);
  }

  _recurseReachable(fromNode: Node, seen: Set<Node>) {
    if (seen.has(fromNode)) {
      return;
    }
    seen.add(fromNode);

    const links = this._l.get(fromNode);
    if (!links) return;
    for (const link of links) {
      const neighbor = link.a === fromNode ? link.b : link.a;
      this._recurseReachable(neighbor, seen);
    }
  }

  dumpNodePoints(): string {
    return this._rb
      .all()
      .map((node) => {
        if (node.geometry.type !== 'LineString') {
          unreachable();
        }
        const coords = node.geometry.coordinates
          .map((c) => c.join(' '))
          .join(', ');
        return `${dumpID(node.id)}: ${coords}`;
      })
      .sort()
      .join('\n');
  }

  dumpNodes(): string {
    return this._rb
      .all()
      .map((node) => `${dumpID(node.id)};`)
      .sort()
      .join('\n');
  }

  dumpLinks(): string {
    const linkSet = new Set<Link>();
    for (const group of this._l.values()) {
      for (const link of group) {
        linkSet.add(link);
      }
    }

    return Array.from(linkSet.values())
      .map((link) => {
        if (link.a.id < link.b.id) {
          return `${dumpID(link.a.id)} -- ${dumpID(link.b.id)};`;
        } else {
          return `${dumpID(link.b.id)} -- ${dumpID(link.a.id)};`;
        }
      })
      .sort()
      .join('\n');
  }
}

function containsEqualCoordinate(seq: Position[], coord: Position): boolean {
  for (const candidate of seq) {
    if (coordinatesEqual(candidate, coord)) {
      return true;
    }
  }
  return false;
}

function coordinatesEqual(a: Position, b: Position): boolean {
  const delta = 0.000_000_9;
  return Math.abs(a[0]! - b[0]!) < delta && Math.abs(a[1]! - b[1]!) < delta;
}

function bidirectionalLinkEqual(l1: Link, l2: Link): boolean {
  return (l1.a === l2.a && l1.b === l2.b) || (l1.a === l2.b && l1.b === l2.a);
}

function dumpID(id: string) {
  return '"' + id + '"';
}

class NodeRBush extends RBush<Node> {
  toBBox(node: Node) {
    return {
      minX: node.bbox[0],
      minY: node.bbox[1],
      maxX: node.bbox[2],
      maxY: node.bbox[3],
    };
  }

  compareMinX(a: Node, b: Node) {
    return a.bbox[0] - b.bbox[0];
  }

  compareMinY(a: Node, b: Node) {
    return a.bbox[1] - b.bbox[1];
  }

  overlaps(node: Node) {
    return this.search(this.toBBox(node));
  }

  overlapsPoint(point: Position, slop?: number) {
    return this.search({
      minX: point[0]! - (slop ?? 0),
      minY: point[1]! - (slop ?? 0),
      maxX: point[0]! + (slop ?? 0),
      maxY: point[1]! + (slop ?? 0),
    });
  }
}

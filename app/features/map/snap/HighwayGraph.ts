import { wait } from '@/time';
import RBush from 'rbush';
import { Feature, LineString, Position } from 'geojson';
import { decodePolyline } from '@/features/tracks/polyline';
import pointToLineDistance from '@turf/point-to-line-distance';
import { lineString } from '@turf/helpers';
import { aStarPathSearch } from '@/features/map/snap/aStar';
import { searchPathToLine } from '@/features/map/snap/searchPathToLine';
import { Semaphore } from '@/Semaphore';

const maxConcurrentDownloads = 2;

export class HighwaySegment {
  constructor(
    public readonly id: number,
    public readonly polyline: string,
    public readonly meters: number,
    public readonly bbox: [number, number, number, number],
    public readonly start: number,
    public readonly end: number,
  ) {}

  static fromData(data: {
    id: number;
    polyline: string;
    meters: number;
    bbox: [number, number, number, number];
    start: number;
    end: number;
  }) {
    return new HighwaySegment(
      data.id,
      data.polyline,
      data.meters,
      data.bbox,
      data.start,
      data.end,
    );
  }

  private _feature: Feature<LineString> | undefined;

  get feature(): Feature<LineString> {
    if (!this._feature) {
      this._feature = lineString(decodePolyline(this.polyline));
    }
    return this._feature;
  }

  get geometry(): LineString {
    return this.feature.geometry;
  }

  // required by RBush
  get minX(): number {
    return this.bbox[0];
  }

  get minY(): number {
    return this.bbox[1];
  }

  get maxX(): number {
    return this.bbox[2];
  }

  get maxY(): number {
    return this.bbox[3];
  }
}

interface TileData {
  segments: {
    id: number;
    polyline: string;
    meters: number;
    bbox: [number, number, number, number];
    start: number;
    end: number;
  }[];
  links: { from: number; to: number[] }[];
}

const closeDist = 5 / 3600; // 5 arc-seconds

export class HighwayGraph {
  private _loaded = new Set<string>();

  private _nextRequestID = 1;
  private _inFlight = new Map<
    string,
    { requesters: number[]; controller: AbortController }
  >();
  private _downloadSem = new Semaphore(maxConcurrentDownloads);

  public readonly segments = new Map<number, HighwaySegment>();

  // This uses ids rather than references so that links inserted when
  // neighboring segments aren't yet loaded will automatically start working
  // once the neighboring tile is loaded.
  public readonly links = new Map<number, number[]>();

  public readonly index = new RBush<HighwaySegment>();

  constructor(
    public readonly endpoint: string = 'https://plantopo-storage.b-cdn.net/highway-graph/',
  ) {}

  findPath(
    start: Position,
    goal: Position,
    limitMeters?: number,
  ): LineString | null {
    const startSeg = this.findCloseTo(start);
    const goalSeg = this.findCloseTo(goal);
    if (!startSeg || !goalSeg) return null;

    let segs: HighwaySegment[] | null;
    if (startSeg !== goalSeg) {
      segs = aStarPathSearch(this, startSeg, goalSeg, limitMeters);
    } else {
      segs = [startSeg];
    }
    if (!segs) return null;

    return searchPathToLine(start, goal, goalSeg, segs);
  }

  findCloseTo(target: Position): HighwaySegment | undefined {
    const candidates = this.index.search({
      minX: target[0]! - closeDist,
      minY: target[1]! - closeDist,
      maxX: target[0]! + closeDist,
      maxY: target[1]! + closeDist,
    });
    let hit: HighwaySegment | undefined;
    let minDist = Infinity;
    for (const c of candidates) {
      const dist = pointToLineDistance(target, c.feature, { units: 'meters' });
      if (dist < minDist) {
        minDist = dist;
        hit = c;
      }
    }
    if (minDist < 100) {
      return hit;
    }
  }

  load(bbox: [number, number, number, number]): () => void {
    const requesterID = this._nextRequestID++;

    const minTileX = Math.floor(bbox[0] * 10);
    const minTileY = Math.floor(bbox[1] * 10);
    const maxTileX = Math.ceil(bbox[2] * 10);
    const maxTileY = Math.ceil(bbox[3] * 10);
    const tiles: string[] = [];
    for (let x = minTileX; x <= maxTileX; x++) {
      for (let y = minTileY; y <= maxTileY; y++) {
        tiles.push(y + '/' + x);
      }
    }

    for (const tile of tiles) {
      this._fetch(tile, requesterID).catch(() => {});
    }

    return () => {
      for (const tile of tiles) {
        const meta = this._inFlight.get(tile);
        if (
          meta &&
          meta.requesters.length === 1 &&
          meta.requesters[0] === requesterID
        ) {
          meta.controller.abort();
          this._inFlight.delete(tile);
        }
      }
    };
  }

  private async _fetch(tile: string, requesterID: number) {
    if (this._loaded.has(tile)) {
      return;
    }

    if (this._inFlight.has(tile)) {
      this._inFlight.get(tile)!.requesters.push(requesterID);
      return;
    }

    // Fetch

    const controller = new AbortController();
    this._inFlight.set(tile, { controller, requesters: [requesterID] });
    let body: TileData | undefined;
    while (true) {
      if (controller.signal.aborted) return;
      await this._downloadSem.use(async () => {
        try {
          const resp = await fetch(this.endpoint + tile, {
            signal: controller.signal,
          });
          if (resp.status === 404) {
            return;
          } else if (resp.status !== 200) {
            throw new Error('fetch highway graph tile: status ' + resp.status);
          }
          body = await resp.json();
        } catch (err) {
          if (err instanceof Error && err.name === 'AbortError') {
            return;
          }
          console.warn('failed to fetch tile', tile, err);
        }
      });
      if (body) {
        break;
      }
      await wait(1_000);
    }
    this._inFlight.delete(tile);

    // Handle data

    const segments: HighwaySegment[] = [];
    for (const segment of body.segments) {
      segments.push(HighwaySegment.fromData(segment));
    }

    for (const segment of segments) {
      this.segments.set(segment.id, segment);
    }

    for (const link of body.links) {
      this.links.set(link.from, link.to);
    }

    this.index.load(segments);

    this._loaded.add(tile);
  }
}

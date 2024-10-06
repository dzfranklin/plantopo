import { wait } from '@/time';
import RBush from 'rbush';
import { Feature, LineString } from 'geojson';
import { decodePolyline } from '@/features/tracks/polyline';
import pointToLineDistance from '@turf/point-to-line-distance';
import { lineString } from '@turf/helpers';

// TODO: limit concurrent requests so we don't starve the map tiles

export class HighwaySegment {
  constructor(
    public readonly id: string,
    public readonly polyline: string,
    public readonly meters: number,
    public readonly bbox: [number, number, number, number],
  ) {}

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
  segments: Record<string, HighwaySegment>;
  links: Record<string, string[]>;
}

const closeDist = 5 / 3600; // 5 arc-seconds

export class HighwayGraph {
  private _loaded = new Set<string>();

  private _nextRequestID = 1;
  private _inFlight = new Map<
    string,
    { requesters: number[]; controller: AbortController }
  >();

  public readonly segments = new Map<string, HighwaySegment>();

  // This uses ids rather than references so that links inserted when
  // neighboring segments aren't yet loaded will automatically start working
  // once the neighboring tile is loaded.
  public readonly links = new Map<string, string[]>();

  public readonly index = new RBush<HighwaySegment>();

  constructor(public readonly endpoint: string) {}

  findCloseTo(target: [number, number]): HighwaySegment | undefined {
    const candidates = this.index.search({
      minX: target[0] - closeDist,
      minY: target[1] - closeDist,
      maxX: target[0] + closeDist,
      maxY: target[1] + closeDist,
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
    let body: TileData;
    while (true) {
      if (controller.signal.aborted) return;
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
        break;
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') {
          return;
        }
        console.warn('failed to fetch tile', tile, err);
        await wait(1_000);
      }
    }
    this._inFlight.delete(tile);

    // Handle data

    const segments: HighwaySegment[] = [];
    for (const [id, segment] of Object.entries(body.segments)) {
      segments.push(
        new HighwaySegment(id, segment.polyline, segment.meters, segment.bbox),
      );
    }

    for (const segment of segments) {
      this.segments.set(segment.id, segment);
    }

    for (const [id, links] of Object.entries(body.links)) {
      this.links.set(id, links);
    }

    this.index.load(segments);

    this._loaded.add(tile);
  }
}

import Point from "@mapbox/point-geometry";

export const MAX_TAP_INTERVAL = 500;
const MAX_TOUCH_TIME = 500;
export const MAX_DIST = 30;

function getCentroid(points: Point[]): Point {
  const sum = new Point(0, 0);
  for (const point of points) {
    sum._add(point);
  }
  return sum.div(points.length);
}

function indexTouches(touches: Touch[], points: Point[]) {
  const obj: Record<number, Point> = {};
  for (let i = 0; i < touches.length; i++) {
    obj[touches[i]!.identifier] = points[i]!;
  }
  return obj;
}

export class SingleTapRecognizer {
  numTouches: number;
  centroid: Point | undefined;
  startTime: number | undefined;
  aborted: boolean = false;
  touches: Record<number, Point> | undefined;

  constructor(options: { numTouches: number }) {
    this.numTouches = options.numTouches;
    this.reset();
  }

  reset() {
    this.centroid = undefined;
    this.startTime = undefined;
    this.touches = undefined;
    this.aborted = false;
  }

  touchstart(e: TouchEvent, points: Point[], mapTouches: Touch[]) {
    if (this.centroid || mapTouches.length > this.numTouches) {
      this.aborted = true;
    }
    if (this.aborted) return;

    if (this.startTime === undefined) {
      this.startTime = e.timeStamp;
    }

    if (mapTouches.length === this.numTouches) {
      this.centroid = getCentroid(points);
      this.touches = indexTouches(mapTouches, points);
    }
  }

  touchmove(e: TouchEvent, points: Point[], mapTouches: Touch[]) {
    if (this.aborted || !this.centroid) return;

    const newTouches = indexTouches(mapTouches, points);
    for (const idStr in this.touches) {
      const id = Number(idStr);
      const prevPos = this.touches[id]!;
      const pos = newTouches[id];
      if (!pos || pos.dist(prevPos) > MAX_DIST) {
        this.aborted = true;
      }
    }
  }

  touchend(
    e: TouchEvent,
    points: Point[],
    mapTouches: Touch[],
  ): Point | undefined {
    if (!this.centroid || e.timeStamp - this.startTime! > MAX_TOUCH_TIME) {
      this.aborted = true;
    }

    if (mapTouches.length === 0) {
      const centroid = !this.aborted ? this.centroid : undefined;
      this.reset();
      return centroid;
    }
  }
}

export class TapRecognizer {
  singleTap: SingleTapRecognizer;
  numTaps: number;
  lastTime: number = Infinity;
  lastTap: Point | undefined;
  count: number = 0;

  constructor(options: { numTaps: number; numTouches: number }) {
    this.singleTap = new SingleTapRecognizer(options);
    this.numTaps = options.numTaps;
    this.reset();
  }

  reset() {
    this.lastTime = Infinity;
    this.lastTap = undefined;
    this.count = 0;
    this.singleTap.reset();
  }

  touchstart(e: TouchEvent, points: Point[], mapTouches: Touch[]) {
    this.singleTap.touchstart(e, points, mapTouches);
  }

  touchmove(e: TouchEvent, points: Point[], mapTouches: Touch[]) {
    this.singleTap.touchmove(e, points, mapTouches);
  }

  touchend(
    e: TouchEvent,
    points: Point[],
    mapTouches: Touch[],
  ): Point | undefined {
    const tap = this.singleTap.touchend(e, points, mapTouches);
    if (tap) {
      const soonEnough = e.timeStamp - this.lastTime < MAX_TAP_INTERVAL;
      const closeEnough = !this.lastTap || this.lastTap.dist(tap) < MAX_DIST;

      if (!soonEnough || !closeEnough) {
        this.reset();
      }

      this.count++;
      this.lastTime = e.timeStamp;
      this.lastTap = tap;

      if (this.count === this.numTaps) {
        this.reset();
        return tap;
      }
    }
  }
}

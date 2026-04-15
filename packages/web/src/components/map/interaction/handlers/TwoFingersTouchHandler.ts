import Point from "@mapbox/point-geometry";

import type { Handler, HandlerResult } from "../handler";
import { suppressClick } from "../suppressClick";

function getTouchById(
  mapTouches: Touch[],
  points: Point[],
  identifier: number,
): Point | undefined {
  for (let i = 0; i < mapTouches.length; i++) {
    if (mapTouches[i]!.identifier === identifier) return points[i];
  }
}

abstract class TwoFingersTouchHandler implements Handler {
  _enabled?: boolean;
  _active?: boolean;
  _firstTwoTouches?: [number, number];
  _aroundCenter?: boolean;

  constructor() {
    this.reset();
  }

  reset() {
    this._active = false;
    this._firstTwoTouches = undefined;
  }

  abstract _start(points: [Point, Point]): void;
  abstract _move(
    points: [Point, Point],
    pinchAround: Point | null,
    e: TouchEvent,
  ): HandlerResult | void;

  touchstart(e: TouchEvent, points: Point[], mapTouches: Touch[]) {
    if (this._firstTwoTouches || mapTouches.length < 2) return;
    this._firstTwoTouches = [
      mapTouches[0]!.identifier,
      mapTouches[1]!.identifier,
    ];
    this._start([points[0]!, points[1]!]);
  }

  touchmove(
    e: TouchEvent,
    points: Point[],
    mapTouches: Touch[],
  ): HandlerResult | void {
    if (!this._firstTwoTouches) return;
    e.preventDefault();

    const [idA, idB] = this._firstTwoTouches;
    const a = getTouchById(mapTouches, points, idA);
    const b = getTouchById(mapTouches, points, idB);
    if (!a || !b) return;

    const pinchAround = this._aroundCenter ? null : a.add(b).div(2);
    return this._move([a, b], pinchAround, e);
  }

  touchend(e: TouchEvent, points: Point[], mapTouches: Touch[]) {
    if (!this._firstTwoTouches) return;

    const [idA, idB] = this._firstTwoTouches;
    const a = getTouchById(mapTouches, points, idA);
    const b = getTouchById(mapTouches, points, idB);
    if (a && b) return;

    if (this._active) suppressClick();
    this.reset();
  }

  touchcancel() {
    this.reset();
  }

  enable(options?: { around?: "center" } | boolean | null) {
    this._enabled = true;
    this._aroundCenter =
      !!options &&
      typeof options === "object" &&
      (options as { around?: string }).around === "center";
  }

  disable() {
    this._enabled = false;
    this.reset();
  }

  isEnabled() {
    return !!this._enabled;
  }

  isActive() {
    return !!this._active;
  }
}

/* ── Zoom ─────────────────────────────────────────────────────────────────── */

const defaultZoomRate = 1;
const defaultZoomThreshold = 0.1;

function getZoomDelta(distance: number, lastDistance: number): number {
  return Math.log(distance / lastDistance) / Math.LN2;
}

export class TwoFingersTouchZoomHandler extends TwoFingersTouchHandler {
  _distance?: number;
  _startDistance?: number;
  _zoomRate: number = defaultZoomRate;
  _zoomThreshold: number = defaultZoomThreshold;

  reset() {
    super.reset();
    this._distance = undefined;
    this._startDistance = undefined;
  }

  _start(points: [Point, Point]) {
    this._startDistance = this._distance = points[0].dist(points[1]);
  }

  _move(
    points: [Point, Point],
    pinchAround: Point | null,
  ): HandlerResult | void {
    const lastDistance = this._distance!;
    this._distance = points[0].dist(points[1]);
    if (
      !this._active &&
      Math.abs(getZoomDelta(this._distance, this._startDistance!)) <
        this._zoomThreshold
    )
      return;
    this._active = true;
    return {
      zoomDelta: getZoomDelta(this._distance, lastDistance) * this._zoomRate,
      pinchAround,
    };
  }
}

/* ── Rotate ───────────────────────────────────────────────────────────────── */

const ROTATION_THRESHOLD = 25; // pixels along circumference

function getBearingDelta(a: Point, b: Point): number {
  return (a.angleWith(b) * 180) / Math.PI;
}

export class TwoFingersTouchRotateHandler extends TwoFingersTouchHandler {
  _minDiameter?: number;
  _startVector?: Point;
  _vector?: Point;

  reset() {
    super.reset();
    this._minDiameter = undefined;
    this._startVector = undefined;
    this._vector = undefined;
  }

  _start(points: [Point, Point]) {
    this._startVector = this._vector = points[0].sub(points[1]);
    this._minDiameter = points[0].dist(points[1]);
  }

  _move(
    points: [Point, Point],
    pinchAround: Point | null,
  ): HandlerResult | void {
    const lastVector = this._vector!;
    this._vector = points[0].sub(points[1]);

    if (!this._active && this._isBelowThreshold(this._vector)) return;
    this._active = true;

    return {
      bearingDelta: getBearingDelta(this._vector, lastVector),
      pinchAround,
    };
  }

  _isBelowThreshold(vector: Point): boolean {
    this._minDiameter = Math.min(this._minDiameter!, vector.mag());
    const circumference = Math.PI * this._minDiameter;
    const threshold = (ROTATION_THRESHOLD / circumference) * 360;
    const bearingDeltaSinceStart = getBearingDelta(vector, this._startVector!);
    return Math.abs(bearingDeltaSinceStart) < threshold;
  }
}

/* ── Pitch ────────────────────────────────────────────────────────────────── */

function isVertical(vector: Point): boolean {
  return Math.abs(vector.y) > Math.abs(vector.x);
}

const ALLOWED_SINGLE_TOUCH_TIME = 100;

export class TwoFingersTouchPitchHandler extends TwoFingersTouchHandler {
  _valid?: boolean;
  _firstMove?: number;
  _lastPoints?: [Point, Point];
  _currentTouchCount: number = 0;

  reset() {
    super.reset();
    this._valid = undefined;
    this._firstMove = undefined;
    this._lastPoints = undefined;
  }

  touchstart(e: TouchEvent, points: Point[], mapTouches: Touch[]) {
    super.touchstart(e, points, mapTouches);
    this._currentTouchCount = mapTouches.length;
  }

  _start(points: [Point, Point]) {
    this._lastPoints = points;
    if (isVertical(points[0].sub(points[1]))) {
      this._valid = false;
    }
  }

  _move(
    points: [Point, Point],
    _center: Point | null,
    e: TouchEvent,
  ): HandlerResult | void {
    const vectorA = points[0].sub(this._lastPoints![0]);
    const vectorB = points[1].sub(this._lastPoints![1]);

    this._valid = this._gestureBeginsVertically(vectorA, vectorB, e.timeStamp);
    if (!this._valid) return;

    this._lastPoints = points;
    this._active = true;
    const yDeltaAverage = (vectorA.y + vectorB.y) / 2;
    return { pitchDelta: yDeltaAverage * -0.5 };
  }

  _gestureBeginsVertically(
    vectorA: Point,
    vectorB: Point,
    timeStamp: number,
  ): boolean | undefined {
    if (this._valid !== undefined) return this._valid;

    const threshold = 2;
    const movedA = vectorA.mag() >= threshold;
    const movedB = vectorB.mag() >= threshold;

    if (!movedA && !movedB) return undefined;

    if (!movedA || !movedB) {
      if (this._firstMove === undefined) this._firstMove = timeStamp;
      if (timeStamp - this._firstMove < ALLOWED_SINGLE_TOUCH_TIME)
        return undefined;
      return false;
    }

    const isSameDirection = vectorA.y > 0 === vectorB.y > 0;
    return isVertical(vectorA) && isVertical(vectorB) && isSameDirection;
  }
}

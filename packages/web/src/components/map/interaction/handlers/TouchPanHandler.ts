import Point from "@mapbox/point-geometry";

import type { Handler, HandlerResult } from "../handler";

function indexTouches(
  touches: Touch[],
  points: Point[],
): Record<number, Point> {
  const obj: Record<number, Point> = {};
  for (let i = 0; i < touches.length; i++) {
    obj[touches[i]!.identifier] = points[i]!;
  }
  return obj;
}

export class TouchPanHandler implements Handler {
  _enabled: boolean = false;
  _active: boolean = false;
  _touches: Record<number, Point> = {};
  _clickTolerance: number;
  _sum: Point = new Point(0, 0);

  constructor(options: { clickTolerance: number }) {
    this._clickTolerance = options.clickTolerance || 1;
    this.reset();
  }

  reset() {
    this._active = false;
    this._touches = {};
    this._sum = new Point(0, 0);
  }

  touchstart(
    e: TouchEvent,
    points: Point[],
    mapTouches: Touch[],
  ): HandlerResult | void {
    return this._calculateTransform(e, points, mapTouches);
  }

  touchmove(
    e: TouchEvent,
    points: Point[],
    mapTouches: Touch[],
  ): HandlerResult | void {
    if (!this._active) return;
    e.preventDefault();
    return this._calculateTransform(e, points, mapTouches);
  }

  touchend(e: TouchEvent, points: Point[], mapTouches: Touch[]) {
    this._calculateTransform(e, points, mapTouches);
    if (this._active && mapTouches.length === 0) {
      this.reset();
    }
  }

  touchcancel() {
    this.reset();
  }

  _calculateTransform(
    e: TouchEvent,
    points: Point[],
    mapTouches: Touch[],
  ): HandlerResult | void {
    if (mapTouches.length > 0) this._active = true;

    const touches = indexTouches(mapTouches, points);
    const touchPointSum = new Point(0, 0);
    const touchDeltaSum = new Point(0, 0);
    let touchDeltaCount = 0;

    for (const identifier in touches) {
      const point = touches[identifier]!;
      const prevPoint = this._touches[identifier];
      if (prevPoint) {
        touchPointSum._add(point);
        touchDeltaSum._add(point.sub(prevPoint));
        touchDeltaCount++;
        touches[identifier] = point;
      }
    }

    this._touches = touches;

    if (touchDeltaCount === 0 || !touchDeltaSum.mag()) return;

    const panDelta = touchDeltaSum.div(touchDeltaCount);
    this._sum._add(panDelta);
    if (this._sum.mag() < this._clickTolerance) return;

    const around = touchPointSum.div(touchDeltaCount);
    return { around, panDelta };
  }

  enable() {
    this._enabled = true;
  }

  disable() {
    this._enabled = false;
    this.reset();
  }

  isEnabled() {
    return this._enabled;
  }

  isActive() {
    return this._active;
  }
}

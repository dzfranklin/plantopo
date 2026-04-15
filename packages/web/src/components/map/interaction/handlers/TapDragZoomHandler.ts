import Point from "@mapbox/point-geometry";

import type { Handler, HandlerResult } from "../handler";
import { MAX_DIST, MAX_TAP_INTERVAL, TapRecognizer } from "./TapRecognizer";

const defaultZoomRate = 1;

export class TapDragZoomHandler implements Handler {
  _enabled: boolean = false;
  _active: boolean = false;
  _swipePoint: Point | undefined;
  _swipeTouch: number | undefined;
  _tapTime: number | undefined;
  _tapPoint: Point | undefined;
  _tap: TapRecognizer;
  _zoomRate: number = defaultZoomRate;

  constructor() {
    this._tap = new TapRecognizer({ numTouches: 1, numTaps: 1 });
    this.reset();
  }

  reset() {
    this._active = false;
    this._swipePoint = undefined;
    this._swipeTouch = undefined;
    this._tapTime = undefined;
    this._tapPoint = undefined;
    this._tap.reset();
  }

  touchstart(e: TouchEvent, points: Point[], mapTouches: Touch[]) {
    if (this._swipePoint) return;

    if (!this._tapTime) {
      this._tap.touchstart(e, points, mapTouches);
    } else {
      const swipePoint = points[0]!;
      const soonEnough = e.timeStamp - this._tapTime < MAX_TAP_INTERVAL;
      const closeEnough = this._tapPoint!.dist(swipePoint) < MAX_DIST;

      if (!soonEnough || !closeEnough) {
        this.reset();
      } else if (mapTouches.length > 0) {
        this._swipePoint = swipePoint;
        this._swipeTouch = mapTouches[0]!.identifier;
      }
    }
  }

  touchmove(
    e: TouchEvent,
    points: Point[],
    mapTouches: Touch[],
  ): HandlerResult | void {
    if (!this._tapTime) {
      this._tap.touchmove(e, points, mapTouches);
    } else if (this._swipePoint) {
      if (mapTouches[0]?.identifier !== this._swipeTouch) return;

      const newSwipePoint = points[0]!;
      const dist = newSwipePoint.y - this._swipePoint.y;
      this._swipePoint = newSwipePoint;

      e.preventDefault();
      this._active = true;
      return { zoomDelta: (dist / 128) * this._zoomRate };
    }
  }

  touchend(e: TouchEvent, points: Point[], mapTouches: Touch[]) {
    if (!this._tapTime) {
      const point = this._tap.touchend(e, points, mapTouches);
      if (point) {
        this._tapTime = e.timeStamp;
        this._tapPoint = point;
      }
    } else if (this._swipePoint) {
      if (mapTouches.length === 0) {
        this.reset();
      }
    }
  }

  touchcancel() {
    this.reset();
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

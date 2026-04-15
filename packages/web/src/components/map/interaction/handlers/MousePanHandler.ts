import Point from "@mapbox/point-geometry";

import type { Handler, HandlerResult } from "../handler";
import { suppressClick } from "../suppressClick";

const LEFT_BUTTON = 0;
const RIGHT_BUTTON = 2;

const BUTTONS_FLAGS: Record<number, number> = {
  [LEFT_BUTTON]: 1,
  [RIGHT_BUTTON]: 2,
};

function buttonNoLongerPressed(e: MouseEvent, button: number): boolean {
  const flag = BUTTONS_FLAGS[button];
  if (flag === undefined) return true;
  return e.buttons === undefined || (e.buttons & flag) !== flag;
}

/**
 * Generic drag handler base shared by pan, rotate, and pitch.
 */
class DragHandler<T extends object> implements Handler {
  contextmenu?: Handler["contextmenu"];
  mousedown?: Handler["mousedown"];
  mousemoveWindow?: Handler["mousemoveWindow"];
  mouseupWindow?: Handler["mouseupWindow"];

  _clickTolerance: number;
  _active: boolean = false;
  _enabled: boolean;
  _moved: boolean = false;
  _lastPoint: Point | null = null;
  _eventButton: number | undefined;

  _checkEvent: (e: MouseEvent) => boolean;
  _moveFunc: (last: Point, current: Point) => T;

  constructor(options: {
    enable?: boolean;
    clickTolerance: number;
    checkEvent: (e: MouseEvent) => boolean;
    move: (last: Point, current: Point) => T;
  }) {
    this._enabled = !!options.enable;
    this._clickTolerance = options.clickTolerance || 1;
    this._checkEvent = options.checkEvent;
    this._moveFunc = options.move;

    this.mousedown = this._dragStart;
    this.mousemoveWindow = this._dragMove;
    this.mouseupWindow = this._dragEnd;
    this.contextmenu = (e: MouseEvent) => {
      e.preventDefault();
    };

    this.reset();
  }

  reset() {
    this._active = false;
    this._moved = false;
    this._lastPoint = null;
    this._eventButton = undefined;
  }

  _dragStart = (e: MouseEvent, point: Point): HandlerResult | void => {
    if (!this.isEnabled() || this._lastPoint) return;
    if (!this._checkEvent(e)) return;

    this._eventButton = e.button;
    this._lastPoint = point;
    this._active = true;
  };

  _dragMove = (e: MouseEvent, point: Point): (T & HandlerResult) | void => {
    if (!this.isEnabled() || !this._lastPoint) return;

    // If button was released outside window, bail
    if (buttonNoLongerPressed(e, this._eventButton!)) {
      this._dragEnd(e, point);
      return;
    }

    e.preventDefault();

    if (!this._moved && point.dist(this._lastPoint) < this._clickTolerance)
      return;
    this._moved = true;

    const last = this._lastPoint;
    this._lastPoint = point;
    return this._moveFunc(last, point) as T & HandlerResult;
  };

  _dragEnd = (e: MouseEvent, _point: Point): void => {
    if (!this.isEnabled() || !this._lastPoint) return;
    if (e.button !== this._eventButton) return;
    if (this._moved) suppressClick();
    this.reset();
  };

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

export function createMousePanHandler(options: {
  enable?: boolean;
  clickTolerance: number;
}): Handler {
  return new DragHandler({
    ...options,
    checkEvent: (e: MouseEvent) => e.button === LEFT_BUTTON && !e.ctrlKey,
    move: (last: Point, point: Point) => ({
      around: point,
      panDelta: point.sub(last),
    }),
  });
}

export function createMouseRotateHandler(
  options: { enable?: boolean; clickTolerance: number },
  getCenter: () => Point,
): Handler {
  const rotateDegreesPerPixelMoved = 0.8;
  const minPixelCenterThreshold = 100;

  return new DragHandler({
    ...options,
    checkEvent: (e: MouseEvent) =>
      (e.button === LEFT_BUTTON && e.ctrlKey) ||
      (e.button === RIGHT_BUTTON && !e.ctrlKey),
    move: (last: Point, current: Point) => {
      const center = getCenter();
      if (Math.abs(center.y - last.y) > minPixelCenterThreshold) {
        return {
          bearingDelta: _angleDelta(
            new Point(last.x, current.y),
            current,
            center,
          ),
        };
      }
      let bearingDelta = (current.x - last.x) * rotateDegreesPerPixelMoved;
      if (current.y < center.y) bearingDelta = -bearingDelta;
      return { bearingDelta };
    },
  });
}

export function createMousePitchHandler(options: {
  enable?: boolean;
  clickTolerance: number;
}): Handler {
  const pitchDegreesPerPixelMoved = -0.5;

  return new DragHandler({
    ...options,
    checkEvent: (e: MouseEvent) =>
      (e.button === LEFT_BUTTON && e.ctrlKey) || e.button === RIGHT_BUTTON,
    move: (last: Point, point: Point) => ({
      pitchDelta: (point.y - last.y) * pitchDegreesPerPixelMoved,
    }),
  });
}

function _angleDelta(a: Point, b: Point, center: Point): number {
  // angle in degrees from center to a, then center to b
  const angleA = Math.atan2(a.y - center.y, a.x - center.x);
  const angleB = Math.atan2(b.y - center.y, b.x - center.x);
  return ((angleB - angleA) * 180) / Math.PI;
}

import Point from "@mapbox/point-geometry";
import type ml from "maplibre-gl";

import type { Handler, HandlerResult } from "../handler";
import { mousePos } from "../mousePos";

// deltaY value for mouse scroll wheel identification
const wheelZoomDelta = 4.000244140625;

const defaultZoomRate = 1 / 100;
const wheelZoomRate = 1 / 450;
const maxScalePerFrame = 2;
const wheelEventTimeDiffAdjustment = 5;

function defaultEasing(t: number): number {
  return t * (2 - t);
}

function bezier(p1x: number, p1y: number, p2x: number, p2y: number) {
  // Cubic bezier easing — simplified implementation matching MapLibre's
  return function (t: number): number {
    // Newton's method approximation
    let x = t;
    for (let i = 0; i < 4; i++) {
      const d =
        3 * (1 - x) * (1 - x) * p1x + 6 * (1 - x) * x * p2x + 3 * x * x - x;
      const dd =
        6 * (1 - x) * p1x + 6 * x * p2x + 6 * (1 - x) * p2x + 6 * x - 6 * x;
      if (Math.abs(dd) < 1e-6) break;
      x -= d / (dd || 1);
    }
    const cy = 3 * p1y;
    const by = 3 * (p2y - p1y) - cy;
    const ay = 1 - cy - by;
    return ((ay * x + by) * x + cy) * x;
  };
}

function zoomScale(zoom: number): number {
  return Math.pow(2, zoom);
}

function scaleZoom(scale: number): number {
  return Math.log(scale) / Math.LN2;
}

export class ScrollZoomHandler implements Handler {
  _map: ml.Map;
  _el: HTMLElement;
  _enabled: boolean = false;
  _active: boolean = false;
  _zooming: boolean = false;
  _aroundCenter: boolean = false;
  _aroundPoint: Point | undefined;

  _type: "wheel" | "trackpad" | null = null;
  _lastValue: number = 0;
  _timeout: ReturnType<typeof setTimeout> | undefined;
  _finishTimeout: ReturnType<typeof setTimeout> | undefined;

  _lastWheelEvent: WheelEvent | undefined;
  _lastWheelEventTime: number = 0;
  _lastExpectedZoom: number | undefined;
  _startZoom: number | undefined;
  _targetZoom: number | undefined;
  _delta: number = 0;
  _easing: ((t: number) => number) | undefined;
  _prevEase:
    | { start: number; duration: number; easing: (t: number) => number }
    | undefined;

  _frameId: boolean = false;
  _triggerRenderFrame: () => void;
  _defaultZoomRate: number = defaultZoomRate;
  _wheelZoomRate: number = wheelZoomRate;

  constructor(map: ml.Map, triggerRenderFrame: () => void) {
    this._map = map;
    this._el = map.getCanvas();
    this._triggerRenderFrame = triggerRenderFrame;
    this._delta = 0;
  }

  isEnabled() {
    return !!this._enabled;
  }
  isActive() {
    return !!this._active || this._finishTimeout !== undefined;
  }
  isZooming() {
    return !!this._zooming;
  }

  enable(options?: { around?: "center" } | boolean) {
    if (this.isEnabled()) return;
    this._enabled = true;
    this._aroundCenter =
      !!options && typeof options === "object" && options.around === "center";
  }

  disable() {
    if (!this.isEnabled()) return;
    this._enabled = false;
  }

  wheel(e: WheelEvent): void {
    if (!this.isEnabled()) return;

    let value =
      e.deltaMode === WheelEvent.DOM_DELTA_LINE ? e.deltaY * 40 : e.deltaY;
    const currentTime = performance.now();
    const timeDelta = currentTime - (this._lastWheelEventTime || 0);
    this._lastWheelEventTime = currentTime;

    if (value !== 0 && value % wheelZoomDelta === 0) {
      this._type = "wheel";
    } else if (value !== 0 && Math.abs(value) < 4) {
      this._type = "trackpad";
    } else if (timeDelta > 400) {
      this._type = null;
      this._lastValue = value;
      this._timeout = setTimeout(this._onTimeout, 40, e);
    } else if (!this._type) {
      this._type = Math.abs(timeDelta * value) < 200 ? "trackpad" : "wheel";
      if (this._timeout) {
        clearTimeout(this._timeout);
        this._timeout = undefined;
        value += this._lastValue;
      }
    }

    if (e.shiftKey && value) value = value / 4;

    if (this._type) {
      this._lastWheelEvent = e;
      this._delta -= value;
      if (!this._active) this._start(e);
    }

    e.preventDefault();
  }

  _onTimeout = (initialEvent: WheelEvent) => {
    this._type = "wheel";
    this._delta -= this._lastValue;
    if (!this._active) this._start(initialEvent);
  };

  _start(e: WheelEvent) {
    if (!this._delta) return;
    if (this._frameId) this._frameId = false;

    this._active = true;
    if (!this.isZooming()) this._zooming = true;
    if (this._finishTimeout) {
      clearTimeout(this._finishTimeout);
      this._finishTimeout = undefined;
    }

    const pos = mousePos(this._el, e);
    if (this._aroundCenter) {
      const center = this._map.project(this._map.getCenter());
      this._aroundPoint = center;
    } else {
      this._aroundPoint = pos;
    }

    if (!this._frameId) {
      this._frameId = true;
      this._triggerRenderFrame();
    }
  }

  renderFrame(): HandlerResult | void {
    if (!this._frameId) return;
    this._frameId = false;
    if (!this.isActive()) return;

    const currentZoom = this._map.getZoom();

    if (typeof this._lastExpectedZoom === "number") {
      const externalZoomChange = currentZoom - this._lastExpectedZoom;
      if (typeof this._startZoom === "number")
        this._startZoom += externalZoomChange;
      if (typeof this._targetZoom === "number")
        this._targetZoom += externalZoomChange;
    }

    if (this._delta !== 0) {
      const zoomRate =
        this._type === "wheel" && Math.abs(this._delta) > wheelZoomDelta
          ? this._wheelZoomRate
          : this._defaultZoomRate;

      let scale =
        maxScalePerFrame / (1 + Math.exp(-Math.abs(this._delta * zoomRate)));
      if (this._delta < 0 && scale !== 0) scale = 1 / scale;

      const fromScale =
        typeof this._targetZoom !== "number"
          ? zoomScale(currentZoom)
          : zoomScale(this._targetZoom);
      const targetZoom = scaleZoom(fromScale * scale);
      const minZoom = this._map.getMinZoom();
      const maxZoom = this._map.getMaxZoom();
      this._targetZoom = Math.max(minZoom, Math.min(maxZoom, targetZoom));

      if (this._type === "wheel") {
        this._startZoom = currentZoom;
        this._easing = this._smoothOutEasing(200);
      }
      this._delta = 0;
    }

    const targetZoom =
      typeof this._targetZoom !== "number" ? currentZoom : this._targetZoom;
    const startZoom = this._startZoom;
    const easing = this._easing;

    let finished = false;
    let zoom: number;

    if (this._type === "wheel" && startZoom !== undefined && easing) {
      const lastWheelEventTimeDiff =
        performance.now() - this._lastWheelEventTime;
      const t = Math.min(
        (lastWheelEventTimeDiff + wheelEventTimeDiffAdjustment) / 200,
        1,
      );
      const k = easing(t);
      zoom = startZoom + (targetZoom - startZoom) * k;
      if (t < 1) {
        if (!this._frameId) this._frameId = true;
      } else {
        finished = true;
      }
    } else {
      zoom = targetZoom;
      finished = true;
    }

    this._active = true;

    if (finished) {
      this._active = false;
      this._finishTimeout = setTimeout(() => {
        this._zooming = false;
        this._triggerRenderFrame();
        this._targetZoom = undefined;
        this._lastExpectedZoom = undefined;
        this._finishTimeout = undefined;
      }, 200);
    }

    this._lastExpectedZoom = zoom;

    return {
      noInertia: true,
      needsRenderFrame: !finished,
      zoomDelta: zoom - currentZoom,
      around: this._aroundPoint,
      originalEvent: this._lastWheelEvent,
    };
  }

  _smoothOutEasing(duration: number): (t: number) => number {
    let easing: (t: number) => number = defaultEasing;

    if (this._prevEase) {
      const currentEase = this._prevEase;
      const t = (performance.now() - currentEase.start) / currentEase.duration;
      const speed = currentEase.easing(t + 0.01) - currentEase.easing(t);
      const x = (0.27 / Math.sqrt(speed * speed + 0.0001)) * 0.01;
      const y = Math.sqrt(0.27 * 0.27 - x * x);
      easing = bezier(x, y, 0.25, 1);
    }

    this._prevEase = { start: performance.now(), duration, easing };
    return easing;
  }

  reset() {
    this._active = false;
    this._zooming = false;
    this._targetZoom = undefined;
    this._lastExpectedZoom = undefined;
    if (this._finishTimeout) {
      clearTimeout(this._finishTimeout);
      this._finishTimeout = undefined;
    }
  }
}

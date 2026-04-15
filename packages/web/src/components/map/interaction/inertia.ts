import Point from "@mapbox/point-geometry";
import type ml from "maplibre-gl";

type InertiaOptions = {
  linearity: number;
  easing: (t: number) => number;
  deceleration: number;
  maxSpeed: number;
};

function bezier(p1x: number, p1y: number, p2x: number, p2y: number) {
  return function (t: number): number {
    let x = t;
    for (let i = 0; i < 4; i++) {
      const d =
        3 * (1 - x) * (1 - x) * p1x + 6 * (1 - x) * x * p2x + 3 * x * x - x;
      const dd =
        6 * (1 - x) * p1x + 6 * x * p2x + 6 * (1 - x) * p2x + 6 * x - 6 * x;
      if (Math.abs(dd) < 1e-6) break;
      x -= d / (dd || 1);
    }
    const ay = 1 - 3 * p2y + 3 * p1y;
    const by = 3 * (p2y - p1y) - 3 * p1y;
    const cy = 3 * p1y;
    return ((ay * x + by) * x + cy) * x;
  };
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

const defaultEasingFn = bezier(0, 0, 0.3, 1);

const defaultInertiaOptions: Pick<InertiaOptions, "linearity" | "easing"> = {
  linearity: 0.3,
  easing: defaultEasingFn,
};

const defaultPanInertiaOptions: InertiaOptions = {
  ...defaultInertiaOptions,
  deceleration: 2500,
  maxSpeed: 1400,
};

const defaultZoomInertiaOptions: InertiaOptions = {
  ...defaultInertiaOptions,
  deceleration: 20,
  maxSpeed: 1400,
};

const defaultBearingInertiaOptions: InertiaOptions = {
  ...defaultInertiaOptions,
  deceleration: 1000,
  maxSpeed: 360,
};

const defaultPitchInertiaOptions: InertiaOptions = {
  ...defaultInertiaOptions,
  deceleration: 1000,
  maxSpeed: 90,
};

type InertiaSettings = {
  panDelta?: Point;
  zoomDelta?: number;
  bearingDelta?: number;
  pitchDelta?: number;
  around?: Point;
  pinchAround?: Point;
};

function calculateEasing(
  amount: number,
  inertiaDuration: number,
  inertiaOptions: InertiaOptions,
) {
  const { maxSpeed, linearity, deceleration } = inertiaOptions;
  const speed = clamp(
    (amount * linearity) / (inertiaDuration / 1000),
    -maxSpeed,
    maxSpeed,
  );
  const duration = Math.abs(speed) / (deceleration * linearity);
  return {
    easing: inertiaOptions.easing,
    duration: duration * 1000,
    amount: speed * (duration / 2),
  };
}

function extendDuration(
  easeOptions: Record<string, unknown>,
  result: { duration: number; easing: (t: number) => number },
) {
  const current = easeOptions.duration as number | undefined;
  if (!current || current < result.duration) {
    easeOptions.duration = result.duration;
    easeOptions.easing = result.easing;
  }
}

export class HandlerInertia {
  _map: ml.Map;
  _inertiaBuffer: Array<{ time: number; settings: InertiaSettings }> = [];

  constructor(map: ml.Map) {
    this._map = map;
    this.clear();
  }

  clear() {
    this._inertiaBuffer = [];
  }

  record(settings: InertiaSettings) {
    this._drainInertiaBuffer();
    this._inertiaBuffer.push({ time: performance.now(), settings });
  }

  _drainInertiaBuffer() {
    const cutoff = 160; // ms
    const now = performance.now();
    while (
      this._inertiaBuffer.length > 0 &&
      now - this._inertiaBuffer[0]!.time > cutoff
    ) {
      this._inertiaBuffer.shift();
    }
  }

  _onMoveEnd(
    panInertiaOptions?: Partial<InertiaOptions> | boolean,
  ): ml.EaseToOptions | undefined {
    this._drainInertiaBuffer();
    if (this._inertiaBuffer.length < 2) return undefined;

    const deltas = {
      zoom: 0,
      bearing: 0,
      pitch: 0,
      pan: new Point(0, 0),
      pinchAround: undefined as Point | undefined,
      around: undefined as Point | undefined,
    };

    for (const { settings } of this._inertiaBuffer) {
      deltas.zoom += settings.zoomDelta || 0;
      deltas.bearing += settings.bearingDelta || 0;
      deltas.pitch += settings.pitchDelta || 0;
      if (settings.panDelta) deltas.pan._add(settings.panDelta);
      if (settings.around) deltas.around = settings.around;
      if (settings.pinchAround) deltas.pinchAround = settings.pinchAround;
    }

    const lastEntry = this._inertiaBuffer[this._inertiaBuffer.length - 1]!;
    const duration = lastEntry.time - this._inertiaBuffer[0]!.time;

    const easeOptions: Record<string, unknown> = {};

    if (deltas.pan.mag()) {
      const panOpts: InertiaOptions =
        panInertiaOptions && typeof panInertiaOptions === "object"
          ? { ...defaultPanInertiaOptions, ...panInertiaOptions }
          : defaultPanInertiaOptions;
      const result = calculateEasing(deltas.pan.mag(), duration, panOpts);
      const finalPan = deltas.pan.mult(result.amount / deltas.pan.mag());
      // Convert screen-pixel pan delta to new center
      const currentCenter = this._map.project(this._map.getCenter());
      easeOptions.center = this._map.unproject(currentCenter.sub(finalPan));
      extendDuration(easeOptions, result);
    }

    if (deltas.zoom) {
      const result = calculateEasing(
        deltas.zoom,
        duration,
        defaultZoomInertiaOptions,
      );
      easeOptions.zoom = this._map.getZoom() + result.amount;
      extendDuration(easeOptions, result);
    }

    if (deltas.bearing) {
      const result = calculateEasing(
        deltas.bearing,
        duration,
        defaultBearingInertiaOptions,
      );
      easeOptions.bearing =
        this._map.getBearing() + clamp(result.amount, -179, 179);
      extendDuration(easeOptions, result);
    }

    if (deltas.pitch) {
      const result = calculateEasing(
        deltas.pitch,
        duration,
        defaultPitchInertiaOptions,
      );
      easeOptions.pitch = this._map.getPitch() + result.amount;
      extendDuration(easeOptions, result);
    }

    if (easeOptions.zoom !== undefined || easeOptions.bearing !== undefined) {
      const last =
        deltas.pinchAround === undefined ? deltas.around : deltas.pinchAround;
      easeOptions.around = last
        ? this._map.unproject(last)
        : this._map.getCenter();
    }

    this.clear();
    return { ...(easeOptions as ml.EaseToOptions), noMoveStart: true };
  }
}

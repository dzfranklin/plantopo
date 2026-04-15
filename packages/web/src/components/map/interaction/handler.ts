import type Point from "@mapbox/point-geometry";
import type ml from "maplibre-gl";

/**
 * Handlers interpret DOM events and return camera changes that should be
 * applied to the map (HandlerResults). All changes are deltas — the handler
 * has no knowledge of the map's current state.
 */
export interface Handler {
  enable(): void;
  disable(): void;
  isEnabled(): boolean;
  isActive(): boolean;
  /**
   * Called by InteractionManager at any time to reset everything to initial state.
   */
  reset(): void;

  readonly mousedown?: (e: MouseEvent, point: Point) => HandlerResult | void;
  readonly mousemove?: (e: MouseEvent, point: Point) => HandlerResult | void;
  readonly mousemoveWindow?: (
    e: MouseEvent,
    point: Point,
  ) => HandlerResult | void;
  readonly mouseup?: (e: MouseEvent, point: Point) => HandlerResult | void;
  readonly mouseupWindow?: (
    e: MouseEvent,
    point: Point,
  ) => HandlerResult | void;
  readonly dblclick?: (e: MouseEvent, point: Point) => HandlerResult | void;
  readonly contextmenu?: (e: MouseEvent) => HandlerResult | void;
  readonly wheel?: (e: WheelEvent, point: Point) => HandlerResult | void;
  readonly touchstart?: (
    e: TouchEvent,
    points: Point[],
    mapTouches: Touch[],
  ) => HandlerResult | void;
  readonly touchmove?: (
    e: TouchEvent,
    points: Point[],
    mapTouches: Touch[],
  ) => HandlerResult | void;
  readonly touchmoveWindow?: (
    e: TouchEvent,
    points: Point[],
    mapTouches: Touch[],
  ) => HandlerResult | void;
  readonly touchend?: (
    e: TouchEvent,
    points: Point[],
    mapTouches: Touch[],
  ) => HandlerResult | void;
  readonly touchcancel?: (
    e: TouchEvent,
    points: Point[],
    mapTouches: Touch[],
  ) => HandlerResult | void;
  readonly keydown?: (e: KeyboardEvent) => HandlerResult | void;
  readonly keyup?: (e: KeyboardEvent) => HandlerResult | void;
  /**
   * Called each render frame. Used by ScrollZoomHandler to animate zoom easing.
   */
  readonly renderFrame?: () => HandlerResult | void;
}

export type HandlerResult = {
  panDelta?: Point;
  zoomDelta?: number;
  bearingDelta?: number;
  pitchDelta?: number;
  /** The point to keep fixed when changing the camera. */
  around?: Point | null;
  /** Same as around but for pinch actions, given higher priority. */
  pinchAround?: Point | null;
  /** One-off easing by directly changing the map camera (used by double-click zoom). */
  cameraAnimation?: (map: ml.Map) => void;
  /** The DOM event to attach to any camera change events. */
  originalEvent?: Event;
  /** Request another render frame (used by ScrollZoomHandler). */
  needsRenderFrame?: boolean;
  /** Suppress recording this change for inertia. */
  noInertia?: boolean;
  /**
   * Stop the DOM event from propagating further (e.g. to MapLibre's own click
   * listener). Use when the handler has fully consumed the event.
   */
  capture?: boolean;
};

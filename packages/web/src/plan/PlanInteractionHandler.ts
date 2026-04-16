import Point from "@mapbox/point-geometry";
import type ml from "maplibre-gl";

import type { PlanRenderer } from "./PlanRenderer";
import type { PlanState } from "./types";
import type {
  Handler,
  HandlerResult,
} from "@/components/map/interaction/handler";
import { suppressClick } from "@/components/map/interaction/suppressClick";

const CLICK_TOLERANCE = 3;

/**
 * Handles plan-specific interactions: click to add a waypoint, drag to move one.
 * Registered with highest priority via InteractionManager.addFirst().
 *
 * Hit-testing uses document.elementFromPoint via PlanRenderer.hitTest() so the
 * browser does pixel-perfect shape testing on the SVG marker geometry — no manual
 * math needed. A grab offset is recorded so the point stays under the exact spot
 * the user pressed rather than snapping to centre.
 */
export class PlanInteractionHandler implements Handler {
  private _enabled = false;
  private _map: ml.Map;
  private _getRenderer: () => PlanRenderer | null;
  private _onStateChange: (updater: (prev: PlanState) => PlanState) => void;
  private _nextId = 1;

  // Drag state
  private _draggingId: number | null = null;
  private _dragMoved = false;
  private _lastPoint: Point | null = null;
  /** Offset from the anchor pixel to the press point (anchor - pointer), in canvas coords. */
  private _grabOffset = { x: 0, y: 0 };

  constructor(
    map: ml.Map,
    getRenderer: () => PlanRenderer | null,
    getState: () => PlanState,
    onStateChange: (updater: (prev: PlanState) => PlanState) => void,
  ) {
    this._map = map;
    this._getRenderer = getRenderer;
    void getState;
    this._onStateChange = onStateChange;
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
    return this._draggingId !== null;
  }

  reset() {
    this._draggingId = null;
    this._dragMoved = false;
    this._lastPoint = null;
    this._grabOffset = { x: 0, y: 0 };
  }

  mousedown = (e: MouseEvent, point: Point): HandlerResult | void => {
    if (!this._enabled || e.button !== 0) return;
    const hit = this._getRenderer()?.hitTest(e.clientX, e.clientY);
    if (!hit) return;
    this._draggingId = hit.id;
    this._dragMoved = false;
    this._lastPoint = point;
    this._grabOffset = { x: hit.grabOffsetX, y: hit.grabOffsetY };
    e.preventDefault();
    return { capture: true };
  };

  mousemoveWindow = (_e: MouseEvent, point: Point): HandlerResult | void => {
    if (!this._enabled || this._draggingId === null || !this._lastPoint) return;

    if (!this._dragMoved && point.dist(this._lastPoint) < CLICK_TOLERANCE)
      return;
    this._dragMoved = true;
    this._lastPoint = point;

    this._moveDragged(point.x, point.y);
    return { capture: true, needsRenderFrame: true };
  };

  mouseupWindow = (e: MouseEvent, _point: Point): HandlerResult | void => {
    if (!this._enabled || this._draggingId === null) return;
    if (e.button !== 0) return;
    if (this._dragMoved) suppressClick();
    this.reset();
    return { capture: true };
  };

  touchstart = (
    _e: TouchEvent,
    points: Point[],
    mapTouches: Touch[],
  ): HandlerResult | void => {
    if (!this._enabled || mapTouches.length !== 1) return;
    const touch = mapTouches[0];
    if (!touch) return;
    const hit = this._getRenderer()?.hitTest(touch.clientX, touch.clientY);
    if (!hit) return;
    this._draggingId = hit.id;
    this._dragMoved = false;
    this._lastPoint = points[0]!;
    this._grabOffset = { x: hit.grabOffsetX, y: hit.grabOffsetY };
    return { capture: true };
  };

  touchmove = (
    e: TouchEvent,
    points: Point[],
    _mapTouches: Touch[],
  ): HandlerResult | void => {
    if (!this._enabled || this._draggingId === null || !this._lastPoint) return;
    if (points.length !== 1) return;

    const point = points[0]!;
    if (!this._dragMoved && point.dist(this._lastPoint) < CLICK_TOLERANCE)
      return { capture: true };
    this._dragMoved = true;
    this._lastPoint = point;

    e.preventDefault();
    this._moveDragged(point.x, point.y);
    return { capture: true, needsRenderFrame: true };
  };

  touchend = (
    _e: TouchEvent,
    _points: Point[],
    _mapTouches: Touch[],
  ): HandlerResult | void => {
    if (!this._enabled || this._draggingId === null) return;
    this.reset();
    return { capture: true };
  };

  touchcancel = (
    _e: TouchEvent,
    _points: Point[],
    _mapTouches: Touch[],
  ): HandlerResult | void => {
    if (this._draggingId === null) return;
    this.reset();
    return { capture: true };
  };

  click = (_e: MouseEvent, point: Point): HandlerResult => {
    if (this._draggingId !== null) return { capture: false };
    const lngLat = this._map.unproject(point);
    const id = this._nextId++;
    this._onStateChange(prev => ({
      ...prev,
      points: [
        ...prev.points,
        { id, point: [lngLat.lng, lngLat.lat], type: "control" as const },
      ],
    }));
    return { capture: true };
  };

  /** Apply grab offset, move the DOM marker synchronously, update geo state. */
  private _moveDragged(pointerX: number, pointerY: number) {
    const id = this._draggingId!;
    const anchorX = pointerX + this._grabOffset.x;
    const anchorY = pointerY + this._grabOffset.y;

    this._getRenderer()?.moveDragPoint(id, anchorX, anchorY);

    const lngLat = this._map.unproject({ x: anchorX, y: anchorY } as Point);
    this._onStateChange(prev => ({
      ...prev,
      points: prev.points.map(pt =>
        pt.id === id
          ? { ...pt, point: [lngLat.lng, lngLat.lat] as [number, number] }
          : pt,
      ),
    }));
  }
}

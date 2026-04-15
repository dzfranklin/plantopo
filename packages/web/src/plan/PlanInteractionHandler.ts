import type Point from "@mapbox/point-geometry";
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
 */
export class PlanInteractionHandler implements Handler {
  private _enabled = false;
  private _map: ml.Map;
  private _getRenderer: () => PlanRenderer | null;
  private _getState: () => PlanState;
  private _onStateChange: (updater: (prev: PlanState) => PlanState) => void;
  private _nextId = 1;

  // Drag state
  private _draggingId: number | null = null;
  private _dragMoved = false;
  private _lastPoint: Point | null = null;

  constructor(
    map: ml.Map,
    getRenderer: () => PlanRenderer | null,
    getState: () => PlanState,
    onStateChange: (updater: (prev: PlanState) => PlanState) => void,
  ) {
    this._map = map;
    this._getRenderer = getRenderer;
    this._getState = getState;
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
  }

  mousedown = (e: MouseEvent, point: Point): HandlerResult | void => {
    if (!this._enabled || e.button !== 0) return;
    const renderer = this._getRenderer();
    if (!renderer) return;
    const id = renderer.hitTest(point, this._getState());
    if (id === null) return;
    this._draggingId = id;
    this._dragMoved = false;
    this._lastPoint = point;
    e.preventDefault();
    return { capture: true };
  };

  mousemoveWindow = (_e: MouseEvent, point: Point): HandlerResult | void => {
    if (!this._enabled || this._draggingId === null || !this._lastPoint) return;

    if (!this._dragMoved && point.dist(this._lastPoint) < CLICK_TOLERANCE)
      return;
    this._dragMoved = true;
    this._lastPoint = point;

    // Move the DOM node synchronously — zero rAF latency for the dragged marker.
    const id = this._draggingId;
    this._getRenderer()?.moveDragPoint(id, point.x, point.y);

    // Update geo state so the position is accurate when render() is next called.
    const lngLat = this._map.unproject(point);
    this._onStateChange(prev => ({
      ...prev,
      points: prev.points.map(pt =>
        pt.id === id
          ? { ...pt, point: [lngLat.lng, lngLat.lat] as [number, number] }
          : pt,
      ),
    }));

    return { capture: true, needsRenderFrame: true };
  };

  mouseupWindow = (e: MouseEvent, _point: Point): HandlerResult | void => {
    if (!this._enabled || this._draggingId === null) return;
    if (e.button !== 0) return;
    if (this._dragMoved) suppressClick();
    this.reset();
    return { capture: true };
  };

  click = (_e: MouseEvent, point: Point): HandlerResult => {
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
}

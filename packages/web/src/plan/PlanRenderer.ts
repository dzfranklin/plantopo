import type { LngLatLike } from "maplibre-gl";

import type { PlanState } from "./types";

interface Projector {
  project: (lngLat: LngLatLike) => { x: number; y: number };
}

const WAYPOINT_RADIUS = 10;

const CONTAINER_STYLE =
  "position:absolute; top:0; left:0; width:100%; height:100%; pointer-events:none;";

const POINT_CLASS = "plan-control-point";

const POINT_STYLES = `
.${POINT_CLASS} {
  position: absolute;
  top: 0;
  left: 0;
  border-radius: 50%;
  background: #2563eb;
  border: 2px solid #ffffff;
  box-sizing: border-box;
  cursor: grab;
  pointer-events: auto;
  will-change: transform;
  transition: box-shadow 0.15s ease, background-color 0.15s ease;
}
.${POINT_CLASS}:hover {
  background: #1d4ed8;
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.3);
}
.${POINT_CLASS}:active {
  cursor: grabbing;
  background: #1e40af;
  box-shadow: 0 0 0 6px rgba(37, 99, 235, 0.25);
}
`;

export class PlanRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private pointContainer: HTMLDivElement;
  private projector: Projector;
  /** Map from point id to its DOM element */
  private pointEls = new Map<number, HTMLDivElement>();

  constructor(container: HTMLElement, projector: Projector) {
    this.projector = projector;

    if (!document.getElementById("plan-control-point-styles")) {
      const style = document.createElement("style");
      style.id = "plan-control-point-styles";
      style.textContent = POINT_STYLES;
      document.head.append(style);
    }

    this.canvas = document.createElement("canvas");
    this.canvas.style.cssText = CONTAINER_STYLE;
    container.append(this.canvas);
    this.ctx = this.canvas.getContext("2d")!;

    this.pointContainer = document.createElement("div");
    this.pointContainer.style.cssText = CONTAINER_STYLE;
    container.append(this.pointContainer);
  }

  destroy() {
    this.canvas.remove();
    this.pointContainer.remove();
    this.pointEls.clear();
  }

  /** Returns the id of the point under the given canvas pixel, or null. */
  hitTest(point: { x: number; y: number }, state: PlanState): number | null {
    const r2 = WAYPOINT_RADIUS * WAYPOINT_RADIUS;
    for (let i = state.points.length - 1; i >= 0; i--) {
      const pt = state.points[i]!;
      const [lng, lat] = pt.point;
      const { x, y } = this.projector.project([lng, lat]);
      const dx = point.x - x;
      const dy = point.y - y;
      if (dx * dx + dy * dy <= r2) return pt.id;
    }
    return null;
  }

  /**
   * Move the DOM element for a dragged point directly to pixel position (x, y),
   * bypassing rAF. Call this from mousemove for zero-latency marker tracking.
   */
  moveDragPoint(id: number, x: number, y: number) {
    const el = this.pointEls.get(id);
    if (el) setPointElPosition(el, x, y);
  }

  render(state: PlanState) {
    this._syncCanvas();
    this._drawLines(state);
    this._syncPointEls(state);
  }

  private _syncCanvas() {
    const { offsetWidth, offsetHeight } = this.canvas;
    if (
      this.canvas.width !== offsetWidth ||
      this.canvas.height !== offsetHeight
    ) {
      this.canvas.width = offsetWidth;
      this.canvas.height = offsetHeight;
    }
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  private _drawLines(state: PlanState) {
    if (state.points.length < 2) return;
    const ctx = this.ctx;
    ctx.beginPath();
    for (let i = 0; i < state.points.length; i++) {
      const [lng, lat] = state.points[i]!.point;
      const { x, y } = this.projector.project([lng, lat]);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = "#2563eb";
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  private _syncPointEls(state: PlanState) {
    const seen = new Set<number>();
    for (const pt of state.points) {
      seen.add(pt.id);
      let el = this.pointEls.get(pt.id);
      if (!el) {
        el = createPointEl();
        this.pointEls.set(pt.id, el);
        this.pointContainer.append(el);
      }
      const [lng, lat] = pt.point;
      const { x, y } = this.projector.project([lng, lat]);
      setPointElPosition(el, x, y);
    }
    for (const [id, el] of this.pointEls) {
      if (!seen.has(id)) {
        el.remove();
        this.pointEls.delete(id);
      }
    }
  }
}

function createPointEl(): HTMLDivElement {
  const el = document.createElement("div");
  el.className = POINT_CLASS;
  el.style.width = `${WAYPOINT_RADIUS * 2}px`;
  el.style.height = `${WAYPOINT_RADIUS * 2}px`;
  return el;
}

function setPointElPosition(el: HTMLDivElement, x: number, y: number) {
  el.style.transform = `translate(${x - WAYPOINT_RADIUS}px, ${y - WAYPOINT_RADIUS}px)`;
}

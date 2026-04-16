import type { LngLatLike } from "maplibre-gl";

import type { PlanState } from "./types";

interface Projector {
  project: (lngLat: LngLatLike) => { x: number; y: number };
}

// The small anchor dot drawn at the exact coordinate
const ANCHOR_RADIUS = 4;

// The teardrop handle: a circle offset to the bottom-right of the anchor
const HANDLE_RADIUS = 14;
// Offset of the handle circle centre from the anchor point
const HANDLE_OFFSET_X = 18;
const HANDLE_OFFSET_Y = 18;

const CONTAINER_STYLE =
  "position:absolute; top:0; left:0; width:100%; height:100%; pointer-events:none;";

// SVG viewport is large enough to contain the teardrop without clipping.
// Origin (0,0) = anchor point position.
const SVG_W = HANDLE_OFFSET_X + HANDLE_RADIUS + 3; // right edge + stroke
const SVG_H = HANDLE_OFFSET_Y + HANDLE_RADIUS + 3; // bottom edge + stroke

const MARKER_ID_ATTR = "data-plan-marker-id";

const BLUE = "#2563eb";
const BLUE_DARK = "#1d4ed8";
const WHITE = "#ffffff";

/** Build the SVG path `d` attribute for the teardrop shape. */
function _tearDropPath(): string {
  const cx = HANDLE_OFFSET_X;
  const cy = HANDLE_OFFSET_Y;
  const len = Math.hypot(cx, cy);
  const ux = cx / len;
  const uy = cy / len;
  const perp = { x: -uy, y: ux };
  const tailWidth = HANDLE_RADIUS * 0.55;
  const startAngle = Math.atan2(perp.y, perp.x);
  const endAngle = Math.atan2(-perp.y, -perp.x);

  const p1x = cx + perp.x * tailWidth;
  const p1y = cy + perp.y * tailWidth;
  const p2x = cx - perp.x * tailWidth;
  const p2y = cy - perp.y * tailWidth;

  // Arc end-point (clockwise from startAngle to endAngle)
  const arcX = cx + Math.cos(endAngle) * HANDLE_RADIUS;
  const arcY = cy + Math.sin(endAngle) * HANDLE_RADIUS;
  const arcStartX = cx + Math.cos(startAngle) * HANDLE_RADIUS;
  const arcStartY = cy + Math.sin(startAngle) * HANDLE_RADIUS;

  return [
    `M 0 0`,
    `L ${p1x.toFixed(2)} ${p1y.toFixed(2)}`,
    `L ${arcStartX.toFixed(2)} ${arcStartY.toFixed(2)}`,
    `A ${HANDLE_RADIUS} ${HANDLE_RADIUS} 0 1 1 ${arcX.toFixed(2)} ${arcY.toFixed(2)}`,
    `L ${p2x.toFixed(2)} ${p2y.toFixed(2)}`,
    `Z`,
  ].join(" ");
}

const TEARDROP_PATH = _tearDropPath();

/** Create the SVG markup for a marker. */
function _markerSVG(id: number): string {
  const cx = HANDLE_OFFSET_X;
  const cy = HANDLE_OFFSET_Y;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${SVG_W}" height="${SVG_H}" style="overflow:visible;pointer-events:auto;cursor:grab;" ${MARKER_ID_ATTR}="${id}">
  <path d="${TEARDROP_PATH}" fill="${BLUE}" />
  <circle cx="${cx}" cy="${cy}" r="${HANDLE_RADIUS}" fill="${BLUE}" stroke="${WHITE}" stroke-width="2" />
  <circle cx="0" cy="0" r="${ANCHOR_RADIUS}" fill="${WHITE}" stroke="${BLUE_DARK}" stroke-width="1.5" />
</svg>`;
}

export interface HitResult {
  id: number;
  /** Offset from the anchor pixel to the press point (anchor - pointer), in canvas coords. */
  grabOffsetX: number;
  grabOffsetY: number;
}

export class PlanRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private markerContainer: HTMLDivElement;
  private projector: Projector;
  /** Map from point id to its marker div */
  private markerEls = new Map<number, HTMLDivElement>();

  constructor(container: HTMLElement, projector: Projector) {
    this.projector = projector;

    this.canvas = document.createElement("canvas");
    this.canvas.style.cssText = CONTAINER_STYLE;
    container.append(this.canvas);
    this.ctx = this.canvas.getContext("2d")!;

    this.markerContainer = document.createElement("div");
    this.markerContainer.style.cssText = CONTAINER_STYLE;
    container.append(this.markerContainer);
  }

  destroy() {
    this.canvas.remove();
    this.markerContainer.remove();
    this.markerEls.clear();
  }

  /**
   * Hit-test at a client-coord point (from MouseEvent or Touch).
   * Uses elementFromPoint for pixel-perfect DOM hit testing on the SVG shapes.
   * Returns the matched marker id and grab offset, or null.
   */
  hitTest(clientX: number, clientY: number): HitResult | null {
    const el = document.elementFromPoint(clientX, clientY);
    if (!el) return null;

    // Walk up to find the SVG with our marker id attr (handles clicks on child elements)
    const svg = el.closest(`[${MARKER_ID_ATTR}]`);
    if (!svg) return null;

    const id = parseInt(svg.getAttribute(MARKER_ID_ATTR)!, 10);
    const svgRect = svg.getBoundingClientRect();

    // SVG (0,0) is the anchor point
    const anchorClientX = svgRect.left;
    const anchorClientY = svgRect.top;

    return {
      id,
      grabOffsetX: anchorClientX - clientX,
      grabOffsetY: anchorClientY - clientY,
    };
  }

  /**
   * Move the marker for a dragged point directly to pixel position (x, y),
   * bypassing rAF. Call from pointermove/mousemove for zero-latency tracking.
   */
  moveDragPoint(id: number, x: number, y: number) {
    const el = this.markerEls.get(id);
    if (el) _setMarkerPos(el, x, y);
  }

  render(state: PlanState) {
    this._syncCanvas();
    this._drawLines(state);
    this._syncMarkers(state);
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
    ctx.strokeStyle = BLUE;
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  private _syncMarkers(state: PlanState) {
    const seen = new Set<number>();
    for (const pt of state.points) {
      seen.add(pt.id);
      let el = this.markerEls.get(pt.id);
      if (!el) {
        el = _createMarkerEl(pt.id);
        this.markerEls.set(pt.id, el);
        this.markerContainer.append(el);
      }
      const [lng, lat] = pt.point;
      const { x, y } = this.projector.project([lng, lat]);
      _setMarkerPos(el, x, y);
    }
    for (const [id, el] of this.markerEls) {
      if (!seen.has(id)) {
        el.remove();
        this.markerEls.delete(id);
      }
    }
  }
}

function _createMarkerEl(id: number): HTMLDivElement {
  const el = document.createElement("div");
  el.style.cssText = "position:absolute; top:0; left:0; pointer-events:none;";
  el.innerHTML = _markerSVG(id);
  return el;
}

function _setMarkerPos(el: HTMLDivElement, x: number, y: number) {
  // translate so that (0,0) of the SVG sits at the anchor pixel
  el.style.transform = `translate(${x}px, ${y}px)`;
}

import type { LngLatLike } from "maplibre-gl";

import type { PlanState } from "./types";

interface Projector {
  project: (lngLat: LngLatLike) => { x: number; y: number };
}

const MARKER_ID_ATTR = "data-plan-marker-id";

const BLUE = "#2563eb";
const BLUE_LIGHT = "#3b82f6";
const BLUE_DARK = "#1d4ed8";
const WHITE = "#ffffff";

export interface HitResult {
  id: number;
  /** Offset from the anchor pixel to the press point (anchor - pointer), in canvas coords. */
  grabOffsetX: number;
  grabOffsetY: number;
}

interface MarkerEls {
  handle: HTMLDivElement;
  handlePath: SVGPathElement;
  anchor: HTMLDivElement;
}

const LAYER_STYLE =
  "position:absolute; top:0; left:0; width:100%; height:100%; pointer-events:none;";

const MOBILE_SCALE_FACTOR = 1.3;

export class PlanRenderer {
  private _container: HTMLElement;
  private _mlCanvas: HTMLCanvasElement;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private _handleLayer: HTMLDivElement;
  private _anchorLayer: HTMLDivElement;
  private projector: Projector;
  private markerEls = new Map<number, MarkerEls>();
  private _hoveredId: number | null = null;
  private _activeId: number | null = null;

  // The small anchor dot drawn at the exact coordinate
  private _anchorRadius = 4;
  private _lollipopOffset = 3;

  // Handle blob centre, offset from the anchor point
  private _handleRadius = 10;
  private _handleOffset = 19;

  constructor({
    container,
    mlCanvas,
    projector,
    isMobile,
  }: {
    container: HTMLElement;
    mlCanvas: HTMLCanvasElement;
    projector: Projector;
    isMobile: boolean;
  }) {
    this._container = container;
    this._mlCanvas = mlCanvas;
    this.projector = projector;

    if (isMobile) {
      this._anchorRadius *= MOBILE_SCALE_FACTOR;
      this._lollipopOffset *= MOBILE_SCALE_FACTOR;
      this._handleRadius *= MOBILE_SCALE_FACTOR;
      this._handleOffset *= MOBILE_SCALE_FACTOR;
    }

    this.canvas = document.createElement("canvas");
    this.canvas.style.cssText = LAYER_STYLE;
    container.append(this.canvas);
    this.ctx = this.canvas.getContext("2d")!;

    this._anchorLayer = document.createElement("div");
    this._anchorLayer.style.cssText = LAYER_STYLE + "z-index:1;";
    container.append(this._anchorLayer);

    this._handleLayer = document.createElement("div");
    this._handleLayer.style.cssText = LAYER_STYLE + "z-index:2;";
    container.append(this._handleLayer);

    container.addEventListener("mousemove", this._onMouseMove);
    container.addEventListener("mouseleave", this._onMouseLeave);
    window.addEventListener("keydown", this._onKey);
    window.addEventListener("keyup", this._onKey);
  }

  destroy() {
    this._container.removeEventListener("mousemove", this._onMouseMove);
    this._container.removeEventListener("mouseleave", this._onMouseLeave);
    window.removeEventListener("keydown", this._onKey);
    window.removeEventListener("keyup", this._onKey);
    this.canvas.remove();
    this._handleLayer.remove();
    this._anchorLayer.remove();
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

    // Walk up to find the handle SVG with our marker id attr
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
    const els = this.markerEls.get(id);
    if (els) {
      this._setElPos(els.handle, x, y);
      this._setElPos(els.anchor, x, y);
    }
  }

  setActive(id: number | null) {
    const prev = this._activeId;
    this._activeId = id;
    if (prev !== null) this._updateZ(prev);
    if (id !== null) this._updateZ(id);
  }

  private _onMouseMove = (e: MouseEvent) => {
    const hit = this.hitTest(e.clientX, e.clientY);
    const id = hit?.id ?? null;
    if (this._hoveredId === id) return;
    const prev = this._hoveredId;
    this._hoveredId = id;
    if (prev !== null) this._updateZ(prev);
    if (id !== null) this._updateZ(id);
  };

  private _onKey = (e: KeyboardEvent) => {
    this._handleLayer.style.visibility = e.shiftKey ? "hidden" : "";
  };

  private _onMouseLeave = () => {
    const prev = this._hoveredId;
    this._hoveredId = null;
    if (prev !== null) this._updateZ(prev);
  };

  private _updateZ(id: number) {
    const els = this.markerEls.get(id);
    if (!els) return;
    const elevated = id === this._activeId || id === this._hoveredId;
    const z = elevated ? "2" : "";
    els.handle.style.zIndex = z;
    els.anchor.style.zIndex = z;
    els.handlePath.setAttribute("fill", elevated ? BLUE_LIGHT : BLUE);
  }

  render(state: PlanState) {
    this._syncCanvas();
    this._drawLines(state);
    this._syncMarkers(state);
  }

  private _syncCanvas() {
    // Read dimensions from MapLibre's canvas — it's always up to date, even
    // during resize, whereas our overlay canvas has a stale explicit style.width.
    const dpr = window.devicePixelRatio ?? 1;
    const w = this._mlCanvas.width;
    const h = this._mlCanvas.height;
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
      this.canvas.style.width = `${w / dpr}px`;
      this.canvas.style.height = `${h / dpr}px`;
    }
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.clearRect(0, 0, w, h);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
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
      let els = this.markerEls.get(pt.id);
      if (!els) {
        els = this._createMarkerEls(pt.id);
        this.markerEls.set(pt.id, els);
        this._handleLayer.append(els.handle);
        this._anchorLayer.append(els.anchor);
      }
      const [lng, lat] = pt.point;
      const { x, y } = this.projector.project([lng, lat]);
      this._setElPos(els.handle, x, y);
      this._setElPos(els.anchor, x, y);
    }
    for (const [id, els] of this.markerEls) {
      if (!seen.has(id)) {
        els.handle.remove();
        els.anchor.remove();
        this.markerEls.delete(id);
      }
    }
  }

  private _handleSVG(id: number): string {
    const dim = this._handleOffset + this._handleRadius;
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${dim}" height="${dim}" style="overflow:visible;pointer-events:auto;cursor:grab;filter:drop-shadow(0 1px 3px rgba(0,0,0,0.3));" ${MARKER_ID_ATTR}="${id}">
  <path d="${this._lollipopPath()}" fill="${BLUE}" stroke="${WHITE}" stroke-width="1.5" stroke-linejoin="round" />
</svg>`;
  }

  private _anchorSVG(): string {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1" style="overflow:visible;pointer-events:none;">
  <circle cx="0" cy="0" r="${this._anchorRadius}" fill="${WHITE}" stroke="${BLUE_DARK}" stroke-width="1.5" />
</svg>`;
  }

  /**
   * Single rounded lollipop path: tapers from a point at the origin to a full
   * rounded blob at the handle centre. Uses quadratic curves so the sides
   * curve smoothly outward rather than meeting the circle with a hard corner.
   */
  private _lollipopPath(): string {
    const cx = this._handleOffset;
    const cy = this._handleOffset;
    const len = Math.hypot(cx, cy);
    // Unit vectors along and perpendicular to the stem
    const ax = cx / len;
    const ay = cy / len;
    const px = -ay;
    const py = ax;

    // Tangent points on the far side of the handle circle (away from anchor).
    // The Q curves run from the origin tip to these points, then the minor arc
    // sweeps around the far cap to close the blob.
    const t1x = cx + px * this._handleRadius;
    const t1y = cy + py * this._handleRadius;
    const t2x = cx - px * this._handleRadius;
    const t2y = cy - py * this._handleRadius;

    // Control points sit on the perpendicular at a fraction along the stem,
    // so the sides taper smoothly from the tip.
    const cpFrac = 0.6;
    const cp1x = ax * len * cpFrac + px * this._handleRadius;
    const cp1y = ay * len * cpFrac + py * this._handleRadius;
    const cp2x = ax * len * cpFrac - px * this._handleRadius;
    const cp2y = ay * len * cpFrac - py * this._handleRadius;

    // Tip starts at the edge of the anchor dot, not its centre
    const tipX = ax * (this._anchorRadius + this._lollipopOffset);
    const tipY = ay * (this._anchorRadius + this._lollipopOffset);

    const f = (n: number) => n.toFixed(2);
    return [
      `M ${f(tipX)} ${f(tipY)}`,
      `Q ${f(cp1x)} ${f(cp1y)} ${f(t1x)} ${f(t1y)}`,
      // large-arc=1, sweep=0: go around the far side of the circle
      `A ${this._handleRadius} ${this._handleRadius} 0 1 0 ${f(t2x)} ${f(t2y)}`,
      `Q ${f(cp2x)} ${f(cp2y)} ${f(tipX)} ${f(tipY)}`,
      `Z`,
    ].join(" ");
  }

  private _createMarkerEls(id: number): MarkerEls {
    const handle = document.createElement("div");
    handle.style.cssText =
      "position:absolute; top:0; left:0; pointer-events:none;";
    handle.innerHTML = this._handleSVG(id);
    const handlePath = handle.querySelector("path") as SVGPathElement;

    const anchor = document.createElement("div");
    anchor.style.cssText =
      "position:absolute; top:0; left:0; pointer-events:none;";
    anchor.innerHTML = this._anchorSVG();

    return { handle, handlePath, anchor };
  }

  private _setElPos(el: HTMLDivElement, x: number, y: number) {
    // translate so that (0,0) of the SVG sits at the anchor pixel
    el.style.transform = `translate(${x}px, ${y}px)`;
  }
}

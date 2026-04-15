import Point from "@mapbox/point-geometry";
import type ml from "maplibre-gl";

import type { Handler, HandlerResult } from "./handler";
import { DoubleClickZoomHandler } from "./handlers/DoubleClickZoomHandler";
import {
  createMousePanHandler,
  createMousePitchHandler,
  createMouseRotateHandler,
} from "./handlers/MousePanHandler";
import { ScrollZoomHandler } from "./handlers/ScrollZoomHandler";
import { TapDragZoomHandler } from "./handlers/TapDragZoomHandler";
import { TouchPanHandler } from "./handlers/TouchPanHandler";
import {
  TwoFingersTouchPitchHandler,
  TwoFingersTouchRotateHandler,
  TwoFingersTouchZoomHandler,
} from "./handlers/TwoFingersTouchHandler";
import { HandlerInertia } from "./inertia";
import { mousePos, touchPos } from "./mousePos";

const CLICK_TOLERANCE = 3;

type HandlerEntry = {
  name: string;
  handler: Handler;
  allowed: string[];
};

type EventsInProgress = {
  zoom?: { handlerName: string; originalEvent: Event | undefined };
  drag?: { handlerName: string; originalEvent: Event | undefined };
  pitch?: { handlerName: string; originalEvent: Event | undefined };
  rotate?: { handlerName: string; originalEvent: Event | undefined };
};

function isMoving(p: EventsInProgress): boolean {
  return !!(p.zoom || p.drag || p.pitch || p.rotate);
}

function hasChange(result: HandlerResult): boolean {
  return !!(
    result.panDelta?.mag() ||
    result.zoomDelta ||
    result.bearingDelta ||
    result.pitchDelta
  );
}

export class InteractionManager {
  private _map: ml.Map;
  private _el: HTMLElement;
  private _handlers: HandlerEntry[] = [];
  private _inertia: HandlerInertia;
  private _eventsInProgress: EventsInProgress = {};
  private _previousActiveHandlers: Record<string, Handler> = {};
  private _changes: Array<
    [HandlerResult, EventsInProgress, Record<string, Event | undefined>]
  > = [];
  private _frameId: number | undefined;
  private _updatingCamera = false;
  private _bearingSnap: number;
  // Zoom snap tracking
  private _zoomGestureStart: number | null = null;
  private _zoomAround: Point | null = null;

  private _listeners: Array<
    [
      EventTarget,
      string,
      EventListenerOrEventListenerObject,
      AddEventListenerOptions | undefined,
    ]
  > = [];

  constructor(map: ml.Map) {
    this._map = map;
    this._el = map.getCanvasContainer();
    this._inertia = new HandlerInertia(map);
    this._bearingSnap = 7; // degrees

    this._addDefaultHandlers();
    this._attachListeners();
  }

  private _addDefaultHandlers() {
    const map = this._map;
    const clickTolerance = CLICK_TOLERANCE;
    const getCenter = () => map.project(map.getCenter());

    this._add(
      "mousePan",
      createMousePanHandler({ enable: true, clickTolerance }),
    );
    this._add(
      "mouseRotate",
      createMouseRotateHandler({ enable: true, clickTolerance }, getCenter),
      ["mousePitch"],
    );
    this._add(
      "mousePitch",
      createMousePitchHandler({ enable: true, clickTolerance }),
      ["mouseRotate"],
    );

    const touchPan = new TouchPanHandler({ clickTolerance });
    touchPan.enable();
    this._add("touchPan", touchPan, ["touchZoom", "touchRotate"]);

    const touchZoom = new TwoFingersTouchZoomHandler();
    touchZoom.enable();
    this._add("touchZoom", touchZoom, ["touchPan", "touchRotate"]);

    const touchRotate = new TwoFingersTouchRotateHandler();
    touchRotate.enable();
    this._add("touchRotate", touchRotate, ["touchPan", "touchZoom"]);

    const touchPitch = new TwoFingersTouchPitchHandler();
    touchPitch.enable();
    this._add("touchPitch", touchPitch, ["touchZoom", "touchRotate"]);

    const tapDragZoom = new TapDragZoomHandler();
    tapDragZoom.enable();
    this._add("tapDragZoom", tapDragZoom);

    const doubleClickZoom = new DoubleClickZoomHandler(map);
    doubleClickZoom.enable();
    this._add("doubleClickZoom", doubleClickZoom);

    const scrollZoom = new ScrollZoomHandler(map, () =>
      this._triggerRenderFrame(),
    );
    scrollZoom.enable();
    this._add("scrollZoom", scrollZoom, ["mousePan"]);
  }

  private _add(name: string, handler: Handler, allowed: string[] = []) {
    this._handlers.push({ name, handler, allowed });
  }

  /**
   * Add a handler at the front of the list (highest priority).
   * Returns a dispose function for React useEffect cleanup.
   */
  addFirst(name: string, handler: Handler, allowed: string[] = []): () => void {
    this._handlers.unshift({ name, handler, allowed });
    return () => this.removeHandler(name);
  }

  removeHandler(name: string) {
    const idx = this._handlers.findIndex(e => e.name === name);
    if (idx !== -1) {
      const entry = this._handlers[idx]!;
      entry.handler.reset();
      this._handlers.splice(idx, 1);
      delete this._previousActiveHandlers[name];
    }
  }

  private _attachListeners() {
    const el = this._el;
    const doc = el.ownerDocument!;
    const win = doc.defaultView!;

    const on = (
      target: EventTarget,
      type: string,
      options?: AddEventListenerOptions,
    ) => {
      const listener =
        target === doc ? this._handleWindowEvent : this._handleEvent;
      target.addEventListener(type, listener, options);
      this._listeners.push([target, type, listener, options]);
    };

    on(el, "touchstart", { passive: true });
    on(el, "touchmove", { passive: false });
    on(el, "touchend");
    on(el, "touchcancel");
    on(el, "mousedown");
    on(el, "mousemove");
    on(el, "mouseup");
    on(doc, "mousemove", { capture: true });
    on(doc, "mouseup");
    on(el, "dblclick");
    on(el, "click", { capture: true });
    on(el, "keydown", { capture: false });
    on(el, "keyup");
    on(el, "wheel", { passive: false });
    on(el, "contextmenu");
    on(win, "blur");
  }

  destroy() {
    for (const [target, type, listener, options] of this._listeners) {
      target.removeEventListener(type, listener, options);
    }
    this._listeners = [];
    for (const { handler } of this._handlers) {
      handler.reset();
    }
    this._changes = [];
    if (this._frameId !== undefined) {
      cancelAnimationFrame(this._frameId);
      this._frameId = undefined;
    }
  }

  stop(allowEndAnimation: boolean) {
    if (this._updatingCamera) return;
    for (const { handler } of this._handlers) handler.reset();
    this._inertia.clear();
    this._fireEvents({}, {}, allowEndAnimation);
    this._changes = [];
  }

  isActive() {
    return this._handlers.some(({ handler }) => handler.isActive());
  }

  private _handleWindowEvent = (e: Event) => {
    this._handleEvent(e, `${e.type}Window`);
  };

  private _handleEvent = (e: Event, eventName?: string) => {
    if (e.type === "blur") {
      this.stop(true);
      return;
    }

    this._updatingCamera = true;

    const name = eventName || e.type;
    const inputEvent = name === "renderFrame" ? undefined : (e as UIEvent);
    const canvas = this._map.getCanvas();

    const mergedResult: HandlerResult = { needsRenderFrame: false };
    const eventsInProgress: EventsInProgress = {};
    const activeHandlers: Record<string, Handler> = {};

    for (const entry of this._handlers) {
      const { name: handlerName, handler, allowed } = entry;
      if (!handler.isEnabled()) continue;

      let data: HandlerResult | void = undefined;

      if (this._blockedByActive(activeHandlers, allowed, handlerName)) {
        handler.reset();
      } else {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const h = handler as any;
        if (h[name]) {
          if (isMouseOrWheelEvent(name)) {
            const point = mousePos(canvas, e as MouseEvent);
            data = h[name](e, point) as HandlerResult | void;
          } else if (isTouchEvent(name)) {
            const touchEvent = e as TouchEvent;
            const mapTouches = this._getMapTouches(touchEvent.touches);
            const points = touchPos(canvas, mapTouches);
            data = h[name](
              e,
              points,
              Array.from(mapTouches),
            ) as HandlerResult | void;
          } else {
            data = h[name](e) as HandlerResult | void;
          }

          if (data) {
            this._mergeResult(
              mergedResult,
              eventsInProgress,
              data,
              handlerName,
              inputEvent,
            );
            if (data.needsRenderFrame) this._triggerRenderFrame();
          }
        }
      }

      if (data || handler.isActive()) {
        activeHandlers[handlerName] = handler;
      }
    }

    const deactivated: Record<string, Event | undefined> = {};
    for (const name in this._previousActiveHandlers) {
      if (!activeHandlers[name]) {
        deactivated[name] = inputEvent;
      }
    }
    this._previousActiveHandlers = activeHandlers;

    if (Object.keys(deactivated).length || hasChange(mergedResult)) {
      this._changes.push([mergedResult, eventsInProgress, deactivated]);
      this._triggerRenderFrame();
    }

    this._updatingCamera = false;

    if (mergedResult.capture && inputEvent) {
      inputEvent.stopPropagation();
    }

    const { cameraAnimation } = mergedResult;
    if (cameraAnimation) {
      this._inertia.clear();
      this._fireEvents({}, {}, true);
      this._changes = [];
      cameraAnimation(this._map);
    }
  };

  private _blockedByActive(
    activeHandlers: Record<string, Handler>,
    allowed: string[],
    myName: string,
  ): boolean {
    for (const name in activeHandlers) {
      if (name === myName) continue;
      if (!allowed.includes(name)) return true;
    }
    return false;
  }

  private _getMapTouches(touches: TouchList): TouchList {
    const mapTouches: Touch[] = [];
    for (const t of touches) {
      if (this._el.contains(t.target as Node)) {
        mapTouches.push(t);
      }
    }
    // Return as a TouchList-like object
    return mapTouches as unknown as TouchList;
  }

  private _mergeResult(
    merged: HandlerResult,
    eventsInProgress: EventsInProgress,
    result: HandlerResult,
    handlerName: string,
    e?: UIEvent,
  ) {
    if (!result) return;

    if (result.panDelta !== undefined) merged.panDelta = result.panDelta;
    if (result.zoomDelta !== undefined) merged.zoomDelta = result.zoomDelta;
    if (result.bearingDelta !== undefined)
      merged.bearingDelta = result.bearingDelta;
    if (result.pitchDelta !== undefined) merged.pitchDelta = result.pitchDelta;
    if (result.around !== undefined) merged.around = result.around;
    if (result.pinchAround !== undefined)
      merged.pinchAround = result.pinchAround;
    if (result.noInertia !== undefined) merged.noInertia = result.noInertia;
    if (result.capture) merged.capture = true;
    if (result.needsRenderFrame) merged.needsRenderFrame = true;
    if (result.originalEvent !== undefined)
      merged.originalEvent = result.originalEvent;
    if (result.cameraAnimation !== undefined)
      merged.cameraAnimation = result.cameraAnimation;

    const eventData = {
      handlerName,
      originalEvent: result.originalEvent || e,
    };

    if (result.zoomDelta !== undefined) eventsInProgress.zoom = eventData;
    if (result.panDelta !== undefined) eventsInProgress.drag = eventData;
    if (result.pitchDelta !== undefined) eventsInProgress.pitch = eventData;
    if (result.bearingDelta !== undefined) eventsInProgress.rotate = eventData;
  }

  private _applyChanges() {
    const combined: HandlerResult = {};
    const combinedEventsInProgress: EventsInProgress = {};
    const combinedDeactivated: Record<string, Event | undefined> = {};

    for (const [change, eventsInProgress, deactivated] of this._changes) {
      if (change.panDelta)
        combined.panDelta = (combined.panDelta || new Point(0, 0))._add(
          change.panDelta,
        );
      if (change.zoomDelta)
        combined.zoomDelta = (combined.zoomDelta || 0) + change.zoomDelta;
      if (change.bearingDelta)
        combined.bearingDelta =
          (combined.bearingDelta || 0) + change.bearingDelta;
      if (change.pitchDelta)
        combined.pitchDelta = (combined.pitchDelta || 0) + change.pitchDelta;
      if (change.around !== undefined) combined.around = change.around;
      if (change.pinchAround !== undefined)
        combined.pinchAround = change.pinchAround;
      if (change.noInertia) combined.noInertia = change.noInertia;

      Object.assign(combinedEventsInProgress, eventsInProgress);
      Object.assign(combinedDeactivated, deactivated);
    }

    this._updateCamera(combined, combinedEventsInProgress, combinedDeactivated);
    this._changes = [];
  }

  private _updateCamera(
    result: HandlerResult,
    eventsInProgress: EventsInProgress,
    deactivated: Record<string, Event | undefined>,
  ) {
    if (!hasChange(result)) {
      this._fireEvents(eventsInProgress, deactivated, true);
      return;
    }

    const map = this._map;
    const center = map.project(map.getCenter());
    const around =
      (result.pinchAround !== undefined ? result.pinchAround : result.around) ??
      center;

    let newCenter = center;
    let newZoom = map.getZoom();
    let newBearing = map.getBearing();
    let newPitch = map.getPitch();

    if (result.panDelta) newCenter = newCenter.sub(result.panDelta);
    if (result.bearingDelta) newBearing += result.bearingDelta;
    if (result.pitchDelta) newPitch += result.pitchDelta;

    if (result.zoomDelta) {
      if (this._zoomGestureStart === null)
        this._zoomGestureStart = map.getZoom();
      this._zoomAround = around;
      newZoom += result.zoomDelta;
      const scale = Math.pow(2, result.zoomDelta);
      newCenter = around.add(newCenter.sub(around).div(scale));
    }

    map.jumpTo({
      center: map.unproject(newCenter),
      zoom: newZoom,
      bearing: newBearing,
      pitch: newPitch,
    });

    if (!result.noInertia) {
      this._inertia.record({
        ...result,
        around: result.around ?? undefined,
        pinchAround: result.pinchAround ?? undefined,
      });
    }
    this._fireEvents(eventsInProgress, deactivated, true);
  }

  private _fireEvents(
    newEventsInProgress: EventsInProgress,
    deactivated: Record<string, Event | undefined>,
    allowEndAnimation: boolean,
  ) {
    const wasMoving = isMoving(this._eventsInProgress);
    const nowMoving = isMoving(newEventsInProgress);

    const startEvents: Record<string, Event | undefined> = {};

    for (const eventName in newEventsInProgress) {
      const { originalEvent } =
        newEventsInProgress[eventName as keyof EventsInProgress]!;
      if (!this._eventsInProgress[eventName as keyof EventsInProgress]) {
        startEvents[`${eventName}start`] = originalEvent;
      }
      (this._eventsInProgress as Record<string, unknown>)[eventName] =
        newEventsInProgress[eventName as keyof EventsInProgress];
    }

    if (!wasMoving && nowMoving) {
      this._fireEvent(
        "movestart",
        newEventsInProgress[
          Object.keys(newEventsInProgress)[0] as keyof EventsInProgress
        ]?.originalEvent,
      );
    }

    for (const name in startEvents) {
      this._fireEvent(name, startEvents[name]);
    }

    if (nowMoving) {
      this._fireEvent(
        "move",
        newEventsInProgress[
          Object.keys(newEventsInProgress)[0] as keyof EventsInProgress
        ]?.originalEvent,
      );
    }

    for (const eventName in newEventsInProgress) {
      const { originalEvent } =
        newEventsInProgress[eventName as keyof EventsInProgress]!;
      this._fireEvent(eventName, originalEvent);
    }

    let originalEndEvent: Event | undefined;
    const endEvents: Record<string, Event | undefined> = {};

    for (const eventName in this._eventsInProgress) {
      const entry =
        this._eventsInProgress[eventName as keyof EventsInProgress]!;
      const handlerEntry = this._handlers.find(
        h => h.name === entry.handlerName,
      );
      if (!handlerEntry || !handlerEntry.handler.isActive()) {
        delete (this._eventsInProgress as Record<string, unknown>)[eventName];
        originalEndEvent =
          deactivated[entry.handlerName] || entry.originalEvent;
        endEvents[`${eventName}end`] = originalEndEvent;
      }
    }

    for (const name in endEvents) {
      this._fireEvent(name, endEvents[name]);
    }

    // Zoom snap: when a zoom gesture ends, ease to the nearest snap multiple
    if ("zoomend" in endEvents) {
      const snapInterval = this._map.getZoomSnap();
      const current = this._map.getZoom();
      const start = this._zoomGestureStart;
      const around = this._zoomAround
        ? this._map.unproject(this._zoomAround)
        : undefined;
      this._zoomGestureStart = null;
      this._zoomAround = null;
      if (snapInterval > 0) {
        const zoomingOut = start !== null && current < start;
        const snapped = zoomingOut
          ? Math.floor(current / snapInterval) * snapInterval
          : Math.ceil(current / snapInterval) * snapInterval;
        if (Math.abs(current - snapped) > 1e-9) {
          this._map.easeTo({ zoom: snapped, duration: 130, around });
        }
      }
    }

    const stillMoving = isMoving(this._eventsInProgress);
    const finishedMoving = (wasMoving || nowMoving) && !stillMoving;

    if (allowEndAnimation && finishedMoving) {
      this._updatingCamera = true;
      const inertialEase = this._inertia._onMoveEnd();

      const shouldSnapToNorth = (bearing: number) =>
        bearing !== 0 &&
        -this._bearingSnap < bearing &&
        bearing < this._bearingSnap;

      if (inertialEase && inertialEase.duration) {
        if (
          shouldSnapToNorth(
            (inertialEase.bearing as number | undefined) ??
              this._map.getBearing(),
          )
        ) {
          inertialEase.bearing = 0;
        }
        this._map.easeTo(inertialEase, { originalEvent: originalEndEvent });
      } else {
        this._map.fire("moveend", { originalEvent: originalEndEvent });
        if (shouldSnapToNorth(this._map.getBearing())) {
          this._map.resetNorth();
        }
      }

      this._updatingCamera = false;
    }
  }

  private _fireEvent(type: string, e?: Event) {
    this._map.fire(type, e ? { originalEvent: e } : {});
  }

  private _triggerRenderFrame() {
    if (this._frameId === undefined) {
      this._frameId = requestAnimationFrame(timestamp => {
        this._frameId = undefined;
        // Dispatch a synthetic renderFrame event
        this._handleEvent(
          new CustomEvent("renderFrame", { detail: { timeStamp: timestamp } }),
        );
        this._applyChanges();
      });
    }
  }
}

const mouseEventTypes = new Set([
  "mousedown",
  "mousemove",
  "mousemoveWindow",
  "mouseup",
  "mouseupWindow",
  "dblclick",
  "click",
  "contextmenu",
  "wheel",
]);

const touchEventTypes = new Set([
  "touchstart",
  "touchmove",
  "touchmoveWindow",
  "touchend",
  "touchcancel",
]);

function isMouseOrWheelEvent(name: string): boolean {
  return mouseEventTypes.has(name);
}

function isTouchEvent(name: string): boolean {
  return touchEventTypes.has(name);
}

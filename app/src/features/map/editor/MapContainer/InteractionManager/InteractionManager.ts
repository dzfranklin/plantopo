import { RenderFeature } from '../FeatureRenderer';
import RBush from 'rbush';
import { BBox, bbox as computeBBox } from '@turf/turf';
import { CreateFeatureHandler } from './CreateFeatureHandler';
import { CurrentCameraPosition } from '../../CurrentCamera';
import { FeatureHoverHandler as FeatureActionHandler } from './FeatureActionHandler';
import { add2, magnitude2, sub2 } from '@/generic/vector2';
import { clamp } from '@/generic/clamp';
import * as ml from 'maplibre-gl';
import { nearestPointInGeometry } from '../../nearestPointInFeature';
import { SceneFeature } from '../../engine/Scene';
import { EditorEngine } from '../../engine/EditorEngine';
import { SyncGeometry } from '@/gen/sync_schema';

// TODO: Should this be a maplibre handler at the top?

type ScreenXY = [number, number];
type LngLat = [number, number];

export class InteractionEvent {
  private _scope: InteractionManager;
  readonly screenXY: ScreenXY;
  public firedAt: number | null = null;

  constructor(
    scope: InteractionManager,
    pt: ScreenXY,
    public receivedAt: number,
  ) {
    this._scope = scope;
    this.screenXY = pt;
  }

  private _cachedLngLat: LngLat | null = null;

  get camera(): CurrentCameraPosition {
    return this._scope.cam;
  }

  unproject(): LngLat {
    if (this._cachedLngLat === null) {
      this._cachedLngLat = this._scope.unproject(this.screenXY);
    }
    return this._cachedLngLat;
  }

  private _cachedHits: FeatureHit[] | null = null;

  /** The first entry in the list is the feature on top */
  queryHits(): FeatureHit[] {
    if (this._cachedHits === null) {
      const value = this._scope
        .queryHits(this.screenXY, this.unproject())
        .map((f) => new FeatureHitImpl(this, f));
      this._cachedHits = value;
    }
    return this._cachedHits;
  }
}

export interface FeatureHit {
  feature: SceneFeature;

  /** Pixel distance from the event to the nearest point on the feature */
  minPixelsTo(): number;
}

class FeatureHitImpl implements FeatureHit {
  constructor(private scope: InteractionEvent, public feature: SceneFeature) {}

  minPixelsTo(): number {
    const cam = this.scope.camera;
    const g = this.feature.geometry!;
    const targetS = this.scope.screenXY; // target, screen space
    let pM: GeoJSON.Position; // nearest point, map space
    let depth = 0; // pixels from pM to edge
    if (g.type === 'Point') {
      // We want the render tree feature here, which should have the radius
      const FIXME_R = 5;
      pM = g.coordinates;
      depth = Math.round(FIXME_R / 2);
    } else {
      pM = nearestPointInGeometry(this.scope.unproject(), g);
      const FIXME_WIDTH = 2;
      depth = Math.round(FIXME_WIDTH / 2);
    }
    const pS = cam.project(pM);
    const pixelsToCenter = magnitude2(sub2(pS, targetS));
    return clamp(pixelsToCenter - depth, 0, Infinity);
  }
}

export interface InteractionHandler {
  cursor?: string;
  onHover?: (evt: InteractionEvent, engine: EditorEngine) => boolean;
  onPress?: (evt: InteractionEvent, engine: EditorEngine) => boolean;
  onDragStart?: (evt: InteractionEvent, engine: EditorEngine) => boolean;
  onDrag?: (
    evt: InteractionEvent,
    delta: [number, number],
    engine: EditorEngine,
  ) => boolean;
  onDragEnd?: (evt: InteractionEvent, engine: EditorEngine) => boolean;
  // delta is negative for zooms out
  onZoom?: (
    evt: InteractionEvent,
    delta: number,
    engine: EditorEngine,
  ) => boolean;
}

interface IndexEntry {
  id: string;
  idx: number;
  // Required by rbush
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

interface PointerState {
  id: number;
  type: 'mouse' | 'pen' | 'touch';
  down: ScreenXY | null;
  last: ScreenXY | null;
  outside: boolean;
  couldBePress: boolean;
  inDrag: boolean;
}

const BOUND_POINTER_EVENTS = [
  'pointerdown',
  'pointermove',
  'pointerup',
  'pointercancel',
  'pointerout',
] as const;

// Note there's a bug where the cursor update will lag if the chrome devtools is
// open. See <https://stackoverflow.com/questions/36597412/mouse-cursor-set-using-jquery-css-not-changing-until-mouse-moved>

export class InteractionManager {
  private _rbush = new RBush<IndexEntry>();
  private _elem: HTMLElement;
  cam: CurrentCameraPosition;
  private _engine: EditorEngine;
  private _map: ml.Map;

  querySlop: [number, number] = [10, 10]; // In pixels

  handlers: InteractionHandler[] = [
    new FeatureActionHandler(),
    new CreateFeatureHandler(),
  ];

  private _boundOnPointer = this._onPointer.bind(this);
  private _boundOnWheel = this._onWheel.bind(this);
  private _resizeObserver: ResizeObserver;

  constructor(props: {
    engine: EditorEngine;
    initialCamera: CurrentCameraPosition;
    container: HTMLDivElement;
    map: ml.Map;
  }) {
    this.cam = props.initialCamera;
    this._engine = props.engine;
    this._map = props.map;

    const elem = document.createElement('div');
    elem.style.position = 'absolute';
    elem.style.inset = '0';
    elem.style.cursor = 'crosshair';
    const mlElem = props.container.querySelector(
      '.maplibregl-canvas-container.maplibregl-interactive',
    )!;
    mlElem.append(elem);
    this._elem = elem;

    elem.addEventListener('wheel', this._boundOnWheel, {
      capture: true,
    });

    for (const type of BOUND_POINTER_EVENTS) {
      elem.addEventListener(type, this._boundOnPointer, {
        capture: true,
      });
    }

    this._resizeObserver = new ResizeObserver(() => this._onResize());
    this._resizeObserver.observe(elem);
  }

  remove() {
    this._elem.remove();
  }

  register(render: RenderFeature[], camera: CurrentCameraPosition) {
    this.cam = camera;

    const entries: IndexEntry[] = [];
    for (let i = 0; i < render.length; i++) {
      const f = render[i]!;
      const [minX, minY, maxX, maxY] = this._computeBboxCached(f.geometry);
      entries.push({
        id: f.id,
        idx: i,
        minX,
        minY,
        maxX,
        maxY,
      });
    }

    this._rbush = new RBush();
    this._rbush.load(entries);
  }

  queryHits(screen: ScreenXY, lngLat: LngLat): SceneFeature[] {
    // Convert from centered around `screen` to crs
    const p = this.unproject(add2(screen, this.querySlop));
    const slop = sub2(p, lngLat);

    const lngA = lngLat[0] - slop[0];
    const lngB = lngLat[0] + slop[0];
    const latA = lngLat[1] - slop[1];
    const latB = lngLat[1] + slop[1];
    const query = {
      minX: lngA < lngB ? lngA : lngB,
      maxX: lngA > lngB ? lngA : lngB,
      minY: latA < latB ? latA : latB,
      maxY: latA > latB ? latA : latB,
    };

    const hits = this._rbush.search(query);
    hits.sort((a, b) => b.idx - a.idx);

    const features: SceneFeature[] = [];
    for (const hit of hits) {
      const value = this._engine.getFeature(hit.id);
      if (value) {
        features.push(value);
      }
    }

    return features;
  }

  private _pointers: PointerState[] = [];
  private _lastPinchGap: number | null = null;

  _onResize(): void {
    this._pointers.length = 0;
    this._lastPinchGap = null;
  }

  _onPointer(evt: PointerEvent): void {
    const start = performance.now();
    let p = this._pointers.find((p) => p.id === evt.pointerId);
    if (!p) {
      let type: PointerState['type'];
      switch (evt.pointerType) {
        case 'touch':
          type = 'touch';
          break;
        case 'pen':
          type = 'pen';
          break;
        default:
          type = 'mouse';
          break;
      }
      p = {
        id: evt.pointerId,
        type,
        down: null,
        last: null,
        outside: false,
        couldBePress: false,
        inDrag: false,
      };
      this._pointers.push(p);
    }

    const pt: ScreenXY = [evt.offsetX, evt.offsetY];

    switch (evt.type) {
      case 'pointerdown': {
        // Fired when a pointer becomes active buttons state.
        p.down = pt;
        p.couldBePress = true;
        for (const pointer of this._pointers) {
          if (pointer.id === evt.pointerId) continue;
          if (pointer.down) {
            pointer.couldBePress = false;
            p.couldBePress = false;
          }
        }
        break;
      }
      case 'pointermove': {
        // Fired when a pointer changes coordinates. This event is also used if
        // the change in pointer state cannot be reported by other events.
        if (p.inDrag) {
          const ievt = new InteractionEvent(this, pt, start);
          const delta = sub2(pt, p.last!);
          this._fire(evt, 'onDrag', ievt, delta, this._engine);
        } else if (p.down) {
          // CHECK IF PINCH
          let pinchGap: number | null = null;
          for (const pointer of this._pointers) {
            if (pointer === p) continue;
            if (pointer.down && !pointer.outside) {
              const candidate = d(pointer.last!, pt);
              if (pinchGap === null || candidate < pinchGap) {
                pinchGap = candidate;
              }
            }
          }
          let pinchDelta: number | null = null;
          if (pinchGap && pinchGap > 7 && this._lastPinchGap !== null) {
            pinchDelta = pinchGap - this._lastPinchGap;
          }

          if (pinchDelta && pinchDelta > 5) {
            // IS PINCH
            p.couldBePress = false;
            if (this._lastPinchGap !== null) {
              const ievt = new InteractionEvent(this, pt, start);
              this._fire(evt, 'onPress', ievt, this._engine);
            }
            this._lastPinchGap = pinchGap;
          } else if (d(p.down, pt) > 10) {
            // IS DRAG
            p.couldBePress = false;
            p.inDrag = true;
            const ievt = new InteractionEvent(this, p.down, start);
            this._fire(evt, 'onDragStart', ievt, this._engine);
            p.last = pt;
          }
        } else {
          // IS HOVER
          const ievt = new InteractionEvent(this, pt, start);
          this._fire(evt, 'onHover', ievt, this._engine);
        }
        break;
      }
      case 'pointerup': {
        // Fired when a pointer is no longer active buttons state.
        if (p.inDrag) {
          const ievt = new InteractionEvent(this, pt, start);
          this._fire(evt, 'onDragEnd', ievt, this._engine);
        } else if (!p.outside && p.couldBePress) {
          const ievt = new InteractionEvent(this, pt, start);
          this._fire(evt, 'onPress', ievt, this._engine);
        }
        p.down = null;
        p.couldBePress = false;
        p.inDrag = false;
        break;
      }
      case 'pointerleave': {
        // Any of
        // - The pointing device is moved out of the hit test boundaries of an
        //   element and all of its descendants. Note that setPointerCapture()
        //   or releasePointerCapture() might have changed the hit test target
        //   and while a pointer is captured it is considered to be always
        //   inside the boundaries of the capturing element for the purpose of
        //   firing boundary events.
        // - After firing the pointerup event for a device that does not support
        //   hover (see pointerup).
        // - The user agent has detected a scenario to suppress a pointer event
        //   stream.
        p.outside = true;
        break;
      }
      case 'pointercancel': {
        // A browser fires this event if it concludes the pointer will no longer
        // be able to generate events (for example the related device is
        // deactivated).
        const idx = this._pointers.findIndex((p) => p.id === evt.pointerId);
        if (idx !== -1) this._pointers.splice(idx, 1);
        break;
      }
    }

    p.last = pt;
  }

  private _onWheel(evt: WheelEvent): void {
    const start = performance.now();
    const pt: ScreenXY = [evt.offsetX, evt.offsetY];
    const ievt = new InteractionEvent(this, pt, start);
    const delta = evt.deltaY;
    this._fire(evt, 'onZoom', ievt, delta, this._engine);
  }

  private _mlEnabled = true;

  private _fire<Type extends keyof InteractionHandler>(
    native: PointerEvent | WheelEvent,
    type: Type,
    evt: InteractionEvent,
    ...args: any[]
  ) {
    evt.firedAt = performance.now();
    let cursor: string | undefined = undefined;
    let consumed = false;
    for (const handler of this.handlers) {
      if (!(type in handler)) continue;
      consumed = (handler as any)[type](evt, ...args);
      if (consumed && handler.cursor) {
        cursor = handler.cursor;
      }
      if (consumed) break;
    }

    cursor = cursor || 'crosshair';
    if (this._elem.style.cursor !== cursor) {
      this._elem.style.cursor = cursor;
    }

    if (consumed) {
      native.stopPropagation();
      native.preventDefault();

      if (this._mlEnabled) {
        this._map.scrollZoom.disable();
        this._map.boxZoom.disable();
        this._map.dragRotate.disable();
        this._map.dragPan.disable();
        this._map.keyboard.disable();
        this._map.doubleClickZoom.disable();
        this._map.touchZoomRotate.disable();
        this._map.touchPitch.disable();
        this._mlEnabled = false;
      }
    } else {
      if (!this._mlEnabled) {
        this._map.scrollZoom.enable();
        this._map.boxZoom.enable();
        this._map.dragRotate.enable();
        this._map.dragPan.enable();
        this._map.keyboard.enable();
        this._map.doubleClickZoom.enable();
        this._map.touchZoomRotate.enable();
        this._map.touchPitch.enable();
        this._mlEnabled = true;
      }
    }
  }

  private _bboxCache = new WeakMap<SyncGeometry, BBox>();
  private _computeBboxCached(geo: SyncGeometry): BBox {
    const cached = this._bboxCache.get(geo);
    if (cached) {
      return cached;
    } else {
      const value = computeBBox(geo);
      this._bboxCache.set(geo, value);
      return value;
    }
  }

  unproject(xy: ScreenXY): LngLat {
    return this.cam.unproject(xy);
  }
}

function d(a: [number, number], b: [number, number]): number {
  return Math.sqrt(Math.pow(a[0] - b[0], 2) + Math.pow(a[1] - b[1], 2));
}

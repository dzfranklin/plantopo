import { RenderFeature } from '../FeatureRenderer';
import RBush from 'rbush';
import { FGeometry } from '../../api/propTypes';
import { BBox, bbox as computeBBox } from '@turf/turf';
import { SceneFeature } from '../../api/SyncEngine/Scene';
import { SyncEngine } from '../../api/SyncEngine';
import { CreateFeatureHandler } from './CreateFeatureHandler';
import { CurrentCameraPosition } from '../../CurrentCamera';
import { add2, sub2 } from '@/generic/vector2';

type ScreenXY = [number, number];
type LngLat = [number, number];

export class InteractionEvent {
  private _scope: InteractionManager;
  readonly screenXY: ScreenXY;

  constructor(scope: InteractionManager, pt: ScreenXY) {
    this._scope = scope;
    this.screenXY = pt;
  }

  private _cachedLngLat: LngLat | null = null;

  unproject(): LngLat {
    if (this._cachedLngLat === null) {
      this._cachedLngLat = this._scope.unproject(this.screenXY);
    }
    return this._cachedLngLat;
  }

  private _cachedHits: SceneFeature[] | null = null;

  /** The first entry in the list is the feature on top */
  queryHits(): SceneFeature[] {
    if (this._cachedHits === null) {
      const value = this._scope.queryHits(this.screenXY, this.unproject());
      this._cachedHits = value;
    }
    return this._cachedHits;
  }
}

export interface InteractionHandler {
  onHover?: (evt: InteractionEvent, engine: SyncEngine) => boolean;
  onPress?: (evt: InteractionEvent, engine: SyncEngine) => boolean;
  onDrag?: (
    evt: InteractionEvent,
    delta: [number, number],
    engine: SyncEngine,
  ) => boolean;
  // delta is negative for zooms out
  onZoom?: (
    evt: InteractionEvent,
    delta: number,
    engine: SyncEngine,
  ) => boolean;
}

interface IndexEntry {
  id: number;
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
}

const BOUND_POINTER_EVENTS = [
  'pointerdown',
  'pointermove',
  'pointerup',
  'pointercancel',
  'pointerout',
] as const;

export class InteractionManager {
  private _rbush = new RBush<IndexEntry>();
  private _elem: HTMLElement;
  private _cam: CurrentCameraPosition;
  private _engine: SyncEngine;

  querySlop: [number, number] = [10, 10]; // In pixels

  handlers: InteractionHandler[] = [
    // new DeleteFeatureHandler(),
    new CreateFeatureHandler(),
    // new MoveFeatureHandler(),
    // new SelectFeatureHandler(),
    // new FeatureHoverHandler(),
  ];

  private _boundOnPointer = this._onPointer.bind(this);
  private _boundOnWheel = this._onWheel.bind(this);
  private _resizeObserver: ResizeObserver;

  constructor(props: {
    engine: SyncEngine;
    initialCamera: CurrentCameraPosition;
    container: HTMLDivElement;
  }) {
    this._cam = props.initialCamera;
    this._engine = props.engine;

    const elem = document.createElement('div');
    elem.style.position = 'absolute';
    elem.style.inset = '0';
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
    this._elem.removeEventListener('wheel', this._boundOnWheel, {
      capture: true,
    });

    for (const type of BOUND_POINTER_EVENTS) {
      this._elem.removeEventListener(type, this._boundOnPointer, {
        capture: true,
      });
    }

    this._resizeObserver.disconnect();
  }

  register(render: RenderFeature[], camera: CurrentCameraPosition) {
    this._cam = camera;

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
      const value = this._engine.fLookupSceneNode(hit.id);
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
      };
      this._pointers.push(p);
    }

    const pt: ScreenXY = [evt.offsetX, evt.offsetY];

    let consumed = false;

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

        if (p.down) {
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
          if (pinchGap && pinchGap > 10 && this._lastPinchGap !== null) {
            pinchDelta = pinchGap - this._lastPinchGap;
          }

          if (pinchDelta && pinchDelta > 5) {
            // IS PINCH
            p.couldBePress = false;
            if (this._lastPinchGap !== null) {
              const evt = new InteractionEvent(this, pt);
              for (const handler of this.handlers) {
                consumed = handler.onPress?.(evt, this._engine) ?? false;
                if (consumed) break;
              }
            }
            this._lastPinchGap = pinchGap;
          } else if (d(p.down, pt) > 10) {
            // IS DRAG
            p.couldBePress = false;
            const evt = new InteractionEvent(this, pt);
            const delta: ScreenXY = [pt[0] - p.last![0], pt[1] - p.last![1]];
            for (const handler of this.handlers) {
              consumed = handler.onDrag?.(evt, delta, this._engine) ?? false;
              if (consumed) break;
            }
            p.last = pt;
          }
        } else {
          // IS HOVER
          const evt = new InteractionEvent(this, pt);
          for (const handler of this.handlers) {
            consumed = handler.onHover?.(evt, this._engine) ?? false;
            if (consumed) break;
          }
        }
        break;
      }
      case 'pointerup': {
        // Fired when a pointer is no longer active buttons state.
        if (!p.outside && p.couldBePress) {
          const evt = new InteractionEvent(this, pt);
          for (const handler of this.handlers) {
            consumed = handler.onPress?.(evt, this._engine) ?? false;
            if (consumed) break;
          }
        }
        p.down = null;
        p.couldBePress = false;
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

    if (consumed) {
      evt.preventDefault();
      evt.stopPropagation();
    }
  }

  private _onWheel(evt: WheelEvent): void {
    const pt: ScreenXY = [evt.offsetX, evt.offsetY];

    const ievt = new InteractionEvent(this, pt);
    const delta = evt.deltaY;

    let consumed = false;
    for (const handler of this.handlers) {
      consumed = handler.onZoom?.(ievt, delta, this._engine) ?? false;
      if (consumed) break;
    }

    if (consumed) {
      evt.stopPropagation();
      evt.preventDefault();
    }
  }

  private _bboxCache = new WeakMap<FGeometry, BBox>();
  private _computeBboxCached(geo: FGeometry): BBox {
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
    return this._cam.unproject(xy);
  }
}

function d(a: [number, number], b: [number, number]): number {
  return Math.sqrt(Math.pow(a[0] - b[0], 2) + Math.pow(a[1] - b[1], 2));
}

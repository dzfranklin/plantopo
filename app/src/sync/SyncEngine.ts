import stringOrd from '@/stringOrd';
import { DiGraphMap } from './DiGraphMap';
import { FPos } from './FPos';
import { SyncChange } from './SyncChange';
import { SyncOp } from './SyncOp';
import fracIdxBetween, { isFracIdx } from './fracIdxBetween';
import iterAll from '@/iterAll';

export interface FInsertPlace {
  at: 'before' | 'after' | 'firstChild';
  target: number;
}

/** each `k` such that set(fid, k, v) -> {geoJsonFeature}.properties[k] = v */
const GEO_JSON_FPROPS: Set<Key> = new Set([]);

type Fid = number;
type Lid = number;
type Key = string;
type Value = unknown;
type FracIdx = string;
type FGeoJson = GeoJSON.Feature<GeoJSON.Geometry | null>;
type RootGeoJson = GeoJSON.FeatureCollection<GeoJSON.Geometry | null>;

type PropListener = (v: unknown) => void;
type FChildOrderListener = (order: Array<Fid>) => void;
type FGeoListener = (geo: RootGeoJson) => void;
export type LOrderOp =
  | {
      type: 'add';
      lid: number;
      /** Insert before `after`. */
      after: number | undefined;
    }
  | { type: 'remove'; lid: number }
  | {
      type: 'move';
      lid: number;
      /** Move before `after`. */
      after: number | undefined;
    };
type LOrderListener = (value: Array<Fid>, changes: LOrderOp[]) => void;
type LPaintPropListener = (lid: Lid, key: string, value: unknown) => void;

type FData = {
  validProps: Map<Key, Value>;
  invalidProps?: Map<Key, Value>;
  propNotifier?: Map<
    Key,
    {
      notify: boolean;
      listeners: Set<PropListener>;
    }
  >;
  childOrderListeners?: Set<FChildOrderListener>;
  geoJson?: FGeoJson;
};

type LData = {
  validProps: Map<Key, Value>;
  invalidProps?: Map<Key, Value>;
  propNotifier?: Map<
    Key,
    {
      notify: boolean;
      listeners: Set<PropListener>;
    }
  >;
  notifyPaintProps?: Set<Key>;
};

const ROOT_FPOS: FPos = { parent: 0, idx: '' };

/**
 * # Immutability of values
 *
 * The objects passed into callbacks won't be mutated ever after **unless
 * otherwise stated in the relevant addListener method.**
 *
 * Callbacks must not mutate objects they're passed.
 *
 * Remember that mutations will happen when we asyncronously receive updates so
 * you can't hold a value across a suspend and expect it to be stable.
 *
 * # Validity
 *
 * If we're told to set a prop to something inconsistent with our view of the
 * state (e.g. "pos" to something that would cycle) then we don't change the
 * value in validProps and add the incoming value to invalidProps.
 *
 * Eventually we'll converge with the server's consistent state, so we can just
 * wait.
 *
 * We never manufacture a fake valid value.
 *
 * We make a best-effort attempt to throw if we're sent something that couldn't
 * have been valid regardless of what the server thinks our state is. (e.g. a
 * feature missing a pos or a pos.parent we don't know about even after taking
 * into account the full change the server sent). This should never happen.  We
 * make a best-effort attempt not to include such invalid values in validProps.
 *
 * # Mutation
 *
 * Mutating methods don't make changes directly. Instead they assemble SyncOps
 * and then call `_apply`. This enforces consistency with what we send to the
 * server.
 */
export class SyncEngine {
  private _send: (_: SyncOp[]) => void;

  private _updateSummary = {
    count: 0,
    fPropNotifies: new RunningSummary(),
    fChildOrderNotifies: new RunningSummary(),
    fGeoNotifies: new RunningSummary(),
    lPropNotifies: new RunningSummary(),
    lPaintPropNotifies: new RunningSummary(),
    lOrderNotifies: new RunningSummary(),
  };

  // Features

  private _fidBlockStart: number;
  private _fidBlockUntil: number;
  private _nextFid: number;

  private _fData: Map<Fid, FData> = new Map([
    [0, { validProps: new Map([['pos', ROOT_FPOS]]) }],
  ]);
  private _notifyFChildOrder = new Set<Fid>();
  // _fData and _notifyFChildOrder notifies are only called if the fid is also
  // in _notifyFData
  private _notifyFData = new Set<Fid>();

  private _fTree = new DiGraphMap<FracIdx>();

  private _fGeoJson: RootGeoJson = {
    type: 'FeatureCollection',
    features: [],
  };
  private _notifyFGeoJson = false;
  private _fGeoListeners: Set<FGeoListener> = new Set();

  // Layers

  private _lData: Map<Lid, LData> = new Map();
  private _lPaintPropListeners = new Set<LPaintPropListener>();
  private _notifyLData = new Set<Lid>();

  private _lOrder: Array<{ lid: number; idx: string }> = [];
  private _notifyLOrderOps: Array<LOrderOp> = [];
  private _lOrderListeners: Set<LOrderListener> = new Set();

  constructor(props: {
    fidBlockStart: number;
    fidBlockUntil: number;
    send: (_: SyncOp[]) => void;
  }) {
    if (props.fidBlockUntil <= props.fidBlockStart) {
      throw new Error('Invalid fid block');
    }
    this._fidBlockStart = props.fidBlockStart;
    this._fidBlockUntil = props.fidBlockUntil;
    this._nextFid = props.fidBlockStart;
    this._send = props.send;
  }

  /** Receive a message from the server */
  receive(change: SyncChange): void {
    for (const [fid, k, v] of change.fprops) {
      this._fSet(fid, k, v);
    }
    for (const [lid, k, v] of change.lprops) {
      this._lSet(lid, k, v);
    }
    const convergeDeletes = this._fDelete(new Set(change.fdeletes));
    this._popNotifies();
    if (convergeDeletes !== undefined) {
      this._send([
        { action: 'fDeleteConverge', fids: Array.from(convergeDeletes) },
      ]);
    }
  }

  // Public API - Debugging

  logUpdateSummary(): void {
    console.group('Update summary', new Date());

    console.info(this._updateSummary.count, 'updates');

    const summaries = Object.entries(this._updateSummary)
      .filter((v): v is [string, RunningSummary] => v[0] !== 'count')
      .sort(([a], [b]) => stringOrd(a, b));

    for (const [label, summary] of summaries) {
      console.groupCollapsed(label, summary.nonzeroCount);
      summary.logTable();
      console.groupEnd();
    }

    console.groupEnd();
  }

  fResolvePlace(place: FInsertPlace): {
    parent: number;
    before: FracIdx;
    after: FracIdx;
  } {
    let parent: number;
    let before = '';
    let after = '';
    if (place.at === 'firstChild') {
      parent = place.target;
      const afterFid = this.fChildOrder(parent)[0];
      if (afterFid !== undefined) {
        after = this._fTree.edgeWeight(parent, afterFid) ?? '';
      }
    } else if (place.at === 'before') {
      const afterFid = place.target;
      parent = this.fParent(afterFid) ?? 0;
      after = this._fTree.edgeWeight(parent, afterFid) ?? '';

      const sibs = this.fChildOrder(parent);
      const beforeFid = sibs[sibs.indexOf(place.target) - 1];
      if (beforeFid !== undefined) {
        before = this._fTree.edgeWeight(parent, beforeFid) ?? '';
      }
    } else if (place.at === 'after') {
      const beforeFid = place.target;
      parent = this.fParent(beforeFid) ?? 0;
      before = this._fTree.edgeWeight(parent, beforeFid) ?? '';

      const sibs = this.fChildOrder(parent);
      const afterFid = sibs[sibs.indexOf(place.target) + 1];
      if (afterFid !== undefined) {
        after = this._fTree.edgeWeight(parent, afterFid) ?? '';
      }
    } else {
      throw new Error('Unreachable');
    }
    return { parent, before, after };
  }

  // Public API - Mutate

  /** Creates a feature, returning its fid */
  fCreate(place: FInsertPlace, props: Record<Key, Value> = {}): number {
    const resolved = this.fResolvePlace(place);
    const idx = fracIdxBetween(resolved.before, resolved.after);
    const fid = this._allocateFid();
    this._apply([
      {
        action: 'fCreate',
        fid,
        props: { ...props, pos: { parent: resolved.parent, idx } },
      },
    ]);
    return fid;
  }

  /** Set a feature property.
   *
   * # Special properties
   * - `pos`: Cannot be set
   *
   * # Throws
   * If value is undefined or if a special property rule is violated.
   */
  fSet(fid: Fid, key: Key, value: Value): void {
    if (value === undefined) throw new Error('fSet: value cannot be undefined');
    if (key === 'pos') throw new Error('fSet: Cannot set pos');
    this._apply([{ action: 'fSet', fid, key, value }]);
  }

  /** Moves a list of features
   *
   * The features do not have to share a parent.
   *
   * Any fid in `features` that is an ancestor of another fid in `features` will
   * be skipped.
   *
   * Features are inserted in topological order.
   */
  fMove(features: Fid[], place: FInsertPlace): void {
    // Prune and sort
    if (features.length > 1) {
      const candidates = new Set(features);
      const order: Fid[] = [];
      this._fTree.dfs([0], {
        discover: (n, _, ctrl) => {
          if (order.length === candidates.size) {
            ctrl.breakWith();
          }

          if (candidates.has(n)) {
            order.push(n);
            ctrl.prune();
          }
        },
      });
      features = order;
    }

    const resolved = this.fResolvePlace(place);
    const parent = resolved.parent;
    let before = resolved.before;
    const after = resolved.after;

    const ops: SyncOp[] = [];
    for (const fid of features) {
      const idx = fracIdxBetween(before, after);
      ops.push({
        action: 'fSet',
        fid,
        key: 'pos',
        value: { parent, idx },
      });
      before = idx;
    }

    this._apply(ops);
  }

  /** Recursively delete each feature and all its descendants */
  fDelete(fids: Fid[]): void {
    this._apply([{ action: 'fDelete', fids }]);
  }

  /** Set a layer property
   *
   * # Special properties:
   * - `idx`: Cannot be set
   *
   * # Throws
   * If value is undefined or if a special property rule is violated.
   */
  lSet(lid: number, key: string, value: unknown): void {
    if (value === undefined) throw new Error('lSet: value cannot be undefined');
    if (key === 'idx') throw new Error('lSet: Cannot set idx');
    this._apply([{ action: 'lSet', lid, key, value }]);
  }

  // Public API - Read

  /** Return value will be mutated. You must not mutate it. */
  fGeoJson(): RootGeoJson {
    return this._fGeoJson;
  }

  /** The value passed to the listener may be mutated after the listener
   * returns.
   */
  addFGeoListener(listener: FGeoListener): void {
    this._fGeoListeners.add(listener);
  }

  removeFGeoListener(listener: FGeoListener) {
    this._fGeoListeners.delete(listener);
  }

  /** Get the value of a feature property
   *
   * Properties are never undefined, but (unless special) can be null.
   */
  fProp(fid: number, k: string): unknown {
    return this._fData.get(fid)?.validProps?.get(k) ?? null;
  }

  addFPropListener(fid: number, k: string, cb: PropListener): void {
    const data = this._fData.get(fid);
    if (data === undefined) return;
    if (data.propNotifier === undefined) data.propNotifier = new Map();
    const entry = data.propNotifier.get(k);
    if (entry === undefined) {
      data.propNotifier.set(k, { notify: false, listeners: new Set([cb]) });
    } else {
      entry.listeners.add(cb);
    }
  }

  removeFPropListener(fid: number, k: string, cb: PropListener): void {
    this._fData.get(fid)?.propNotifier?.get(k)?.listeners?.delete(cb);
  }

  lProp(lid: number, k: string): unknown {
    return this._lData.get(lid)?.validProps?.get(k) ?? null;
  }

  addLPropListener(lid: number, k: string, cb: PropListener): void {
    const data = this._lData.get(lid);
    if (data === undefined) return;
    if (data.propNotifier === undefined) data.propNotifier = new Map();
    const entry = data.propNotifier.get(k);
    if (entry === undefined) {
      data.propNotifier.set(k, { notify: false, listeners: new Set([cb]) });
    } else {
      entry.listeners.add(cb);
    }
  }

  removeLPropListener(lid: number, k: string, cb: PropListener): void {
    this._lData.get(lid)?.propNotifier?.get(k)?.listeners?.delete(cb);
  }

  /** Called on every change to a property with the prefix "paint-" */
  addLPaintPropListener(cb: LPaintPropListener): void {
    this._lPaintPropListeners.add(cb);
  }

  removeLPaintPropListener(cb: LPaintPropListener): void {
    this._lPaintPropListeners.delete(cb);
  }

  fParent(fid: Fid): Fid | undefined {
    if (fid === 0) return 0;
    for (const parent of this._fTree.incomingNeighbors(fid)) {
      return parent;
    }
  }

  fChildOrder(parent: number): Array<number> {
    return Array.from(this._fTree.edges(parent))
      .sort(([_ap, _a, aIdx], [_bp, _b, bIdx]) => stringOrd(aIdx, bIdx))
      .map(([_p, n, _i]) => n);
  }

  addFChildOrderListener(fid: number, cb: FChildOrderListener): void {
    const data = this._fData.get(fid);
    if (data === undefined) return;
    if (data.childOrderListeners === undefined) {
      data.childOrderListeners = new Set([cb]);
    } else {
      data.childOrderListeners.add(cb);
    }
  }

  removeFChildOrderListener(fid: number, cb: FChildOrderListener): void {
    this._fData.get(fid)?.childOrderListeners?.delete(cb);
  }

  lOrder(): Array<number> {
    return this._lOrder.map(({ lid }) => lid);
  }

  addLOrderListener(cb: LOrderListener): void {
    this._lOrderListeners.add(cb);
  }

  /** The `changes` passed to the listener may be mutated after the listener
   * returns.
   */
  removeLOrderListener(cb: LOrderListener): void {
    this._lOrderListeners.delete(cb);
  }

  fHasAncestor(fid: number, preds: Set<number>): boolean {
    if (preds.has(fid)) return true;
    if (preds.has(0)) return true;

    let parent = this.fParent(fid);
    while (parent !== undefined && parent !== 0) {
      if (preds.has(parent)) return true;
      parent = this.fParent(parent);
    }

    return false;
  }

  // Private API

  /** All mutations go through
   *
   * Mutates its arguments
   */
  private _apply(ops: SyncOp[]) {
    for (const op of ops) {
      switch (op.action) {
        case 'fCreate': {
          for (const [k, v] of Object.entries(op.props)) {
            this._fSet(op.fid, k, v);
          }
          break;
        }
        case 'fDelete': {
          const missing = this._fDelete(new Set(op.fids));
          if (missing !== undefined) {
            for (const fid of missing) op.fids.push(fid);
          }
          break;
        }
        case 'fSet': {
          this._fSet(op.fid, op.key, op.value);
          break;
        }
        case 'lSet': {
          this._lSet(op.lid, op.key, op.value);
          break;
        }
      }
    }
    this._popNotifies();
    this._send(ops);
  }

  private _popNotifies(): void {
    this._updateSummary.count++;

    let fPropNotifyCount = 0;
    for (const fid of this._notifyFData) {
      const data = this._fData.get(fid);
      if (data === undefined) continue;

      if (data.propNotifier !== undefined) {
        for (const [k, entry] of data.propNotifier) {
          if (!entry.notify) continue;
          const v = data.validProps.get(k);
          for (const l of entry.listeners) l(v);
          entry.notify = false;
          fPropNotifyCount++;
        }
      }
    }
    this._notifyFData.clear();
    this._updateSummary.fPropNotifies.add(fPropNotifyCount);

    let fChildOrderNotifyCount = 0;
    for (const fid of this._notifyFChildOrder) {
      const data = this._fData.get(fid);
      if (data === undefined) continue;
      if (data.childOrderListeners !== undefined) {
        const value = this.fChildOrder(fid);
        for (const l of data.childOrderListeners) l(value);
        fChildOrderNotifyCount++;
      }
    }
    this._notifyFChildOrder.clear();
    this._updateSummary.fChildOrderNotifies.add(fChildOrderNotifyCount);

    if (this._notifyFGeoJson) {
      const value = this._fGeoJson; // note not immutable
      for (const l of this._fGeoListeners) l(value);
      this._updateSummary.fGeoNotifies.add(1);
    } else {
      this._updateSummary.fGeoNotifies.add(0);
    }

    let lPropNotifyCount = 0;
    let lPaintPropNotifyCount = 0;
    for (const lid of this._notifyLData) {
      const data = this._lData.get(lid);
      if (data === undefined) continue;

      if (data.notifyPaintProps !== undefined) {
        for (const k of data.notifyPaintProps) {
          const v = data.validProps.get(k);
          for (const l of this._lPaintPropListeners) l(lid, k, v);
          lPaintPropNotifyCount++;
        }
        data.notifyPaintProps.clear();
      }

      if (data.propNotifier !== undefined) {
        for (const [k, entry] of data.propNotifier) {
          if (!entry.notify) continue;
          const v = data.validProps.get(k);
          for (const l of entry.listeners) l(v);
          entry.notify = false;
          lPropNotifyCount++;
        }
      }
    }
    this._notifyLData.clear();
    this._updateSummary.lPaintPropNotifies.add(lPaintPropNotifyCount);
    this._updateSummary.lPropNotifies.add(lPropNotifyCount);

    if (this._notifyLOrderOps.length > 0) {
      const value = this.lOrder();
      const changes = this._notifyLOrderOps; // note not immutable
      for (const l of this._lOrderListeners) l(value, changes);
      this._updateSummary.lOrderNotifies.add(1);
      this._notifyLOrderOps.length = 0;
    }
  }

  /** Set a property on a feature
   *
   * Acts locally. Enqueues notifications
   */
  private _fSet(fid: number, key: string, value: unknown): void {
    let data = this._fData.get(fid);
    if (data === undefined) {
      data = { validProps: new Map() };
      this._fData.set(fid, data);
    }

    let invalid = false;
    if (key === 'pos') {
      if (!isPos(value)) {
        throw new Error('_fSet: key=pos but !isPosValue(value');
      }

      if (fid === 0) {
        if (value.parent !== 0 || value.idx !== '') {
          throw new Error('_fSet: invalid pos for root');
        }
        // We already have the right materialized values
      } else if (this._wouldCycle(fid, value.parent)) {
        console.log('_fset: invalid as would cycle', fid, '<-', value.parent);
        invalid = true;
      } else {
        this._notifyFChildOrder.add(value.parent);

        const oldParent = this.fParent(fid);
        if (oldParent !== undefined) {
          if (value.parent === oldParent) {
            this._fTree.replaceEdgeWeight(value.parent, fid, value.idx);
          } else {
            this._fTree.removeEdge(oldParent, fid);
            this._fTree.addEdge(value.parent, fid, value.idx);
            this._notifyFChildOrder.add(oldParent);
          }
        } else {
          this._fTree.addEdge(value.parent, fid, value.idx);
        }
      }
    } else if (key === 'geometry') {
      if (value === undefined) {
        if (data.geoJson) data.geoJson.geometry = null;
      } else if (!isGeoJsonGeometry(value)) {
        throw new Error('_fSet: key=geometry but !isGeoJsonGeometry(value');
      } else {
        if (data.geoJson === undefined) {
          data.geoJson = geoJsonFeature(fid, { geometry: value });
          this._fGeoJson.features.push(data.geoJson);
        } else {
          data.geoJson.geometry = value;
        }
      }
      this._notifyFGeoJson = true;
    }

    if (invalid) {
      if (data.invalidProps === undefined) {
        data.invalidProps = new Map([[key, value]]);
      } else {
        data.invalidProps.set(key, value);
      }
    } else {
      data.validProps.set(key, value);

      if (GEO_JSON_FPROPS.has(key)) {
        if (data.geoJson === undefined) {
          data.geoJson = geoJsonFeature(fid, { properties: { [key]: value } });
        } else if (data.geoJson.properties === null) {
          data.geoJson.properties = { [key]: value };
        } else {
          data.geoJson.properties[key] = value;
        }
        this._notifyFGeoJson = true;
      }

      const propNotifier = data.propNotifier?.get(key);
      if (propNotifier !== undefined && propNotifier.listeners.size > 0) {
        this._notifyFData.add(fid);
        propNotifier.notify = true;
      }
    }
  }

  /** Returns the missing recursive deletions, if any.
   *
   * Acts locally. Enqueues notifications
   */
  private _fDelete(incoming: Set<Fid>): Set<Fid> | undefined {
    const parents = new Set<Fid>();
    let convergeDeletes: Set<Fid> | undefined;
    this._fTree.dfs(incoming, {
      discover: (n, _t, _ctrl) => {
        if (!incoming.has(n)) {
          if (convergeDeletes === undefined) convergeDeletes = new Set();
          convergeDeletes.add(n);
        }
        parents.add(this.fParent(n)!);
      },
    });

    for (const fid of iterAll(incoming.values(), convergeDeletes?.values())) {
      this._fData.delete(fid);
      this._notifyFData.delete(fid);
      this._fTree.removeNode(fid);
    }

    for (const parent of parents) {
      // We'll often have deleted the parent as well
      if (this._fTree.containsNode(parent)) {
        this._notifyFChildOrder.add(parent);
      }
    }

    return convergeDeletes;
  }

  /**
   * Would reparenting `fid` under `newParent` cause a cycle?
   *
   * Note a reparent can't create an orphan given a valid status quo without a
   * cycle.
   */
  private _wouldCycle(fid: number, newParent: number): boolean {
    const foundCycle = this._fTree.dfs<boolean>([fid], {
      discover: (n, _t, ctrl) => {
        if (n === newParent) ctrl.breakWith(true);
      },
    });
    return foundCycle || false;
  }

  /** Set a property on a layer
   *
   * Acts locally. Enqueues notifications.
   */
  private _lSet(lid: number, key: string, value: unknown): void {
    let data = this._lData.get(lid);
    if (data === undefined) {
      data = { validProps: new Map() };
      this._lData.set(lid, data);
    }

    let invalid = false;
    if (key === 'idx') {
      if (value !== null && !isFracIdx(value)) {
        throw new Error('_lSet: key=idx but value!==null && !isFracIdx(value)');
      } else if (this._lOrder.find((v) => v.idx === value) !== undefined) {
        console.log('_lset: invalid as idx collides');
        invalid = true;
      } else {
        const prevI = this._lOrder.findIndex((i) => i.lid === lid);
        if (prevI !== -1) {
          this._lOrder.splice(prevI, 1);
        }

        if (value === null) {
          this._notifyLOrderOps.push({ type: 'remove', lid });
        } else {
          this._lOrder.push({ lid, idx: value });
          this._lOrder.sort((a, b) => stringOrd(a.idx, b.idx));
          const newI = this._lOrder.findIndex((i) => i.lid === lid);
          const after = this._lOrder[newI + 1]?.lid;

          if (prevI === -1) {
            this._notifyLOrderOps.push({ type: 'add', lid, after });
          } else {
            this._notifyLOrderOps.push({ type: 'move', lid, after });
          }
        }
      }
    }

    if (invalid) {
      if (data.invalidProps === undefined) {
        data.invalidProps = new Map([[key, value]]);
      } else {
        data.invalidProps.set(key, value);
      }
    } else {
      data.validProps.set(key, value);

      let notifyData = false;

      if (key.startsWith('paint-')) {
        notifyData = true;
        if (data.notifyPaintProps === undefined) {
          data.notifyPaintProps = new Set([key]);
        } else {
          data.notifyPaintProps.add(key);
        }
      }

      const propNotifier = data.propNotifier?.get(key);
      if (propNotifier !== undefined && propNotifier.listeners.size > 0) {
        notifyData = true;
        propNotifier.notify = true;
      }

      if (notifyData) {
        this._notifyLData.add(lid);
      }
    }
  }

  private _allocateFid(): number {
    if (this._nextFid < this._fidBlockUntil) {
      return this._nextFid++;
    } else {
      throw new Error('out of fids');
    }
  }
}

function geoJsonFeature(fid: Fid, props: Partial<FGeoJson>): FGeoJson {
  return {
    id: fid,
    geometry: null,
    properties: null,
    ...props,
    type: 'Feature',
  };
}

function isPos(value: unknown): value is FPos {
  if (!value || typeof value !== 'object') return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record['parent'] === 'number' && typeof record['idx'] === 'string'
  );
}

function isGeoJsonGeometry(value: unknown): value is GeoJSON.Geometry {
  if (!value || typeof value !== 'object') return false;
  const record = value as Record<string, unknown>;
  if (record['type'] === 'Point') {
    return isGeoJsonPosition(record['coordinates']);
  } else if (record['type'] === 'MultiPoint') {
    const coords = record['coordinates'];
    if (!Array.isArray(coords)) return false;
    for (const c of coords) {
      if (!isGeoJsonPosition(c)) return false;
    }
    return true;
  } else if (record['type'] === 'LineString') {
    const coords = record['coordinates'];
    if (!Array.isArray(coords)) return false;
    for (const c of coords) {
      if (!isGeoJsonPosition(c)) return false;
    }
    return true;
  } else if (record['type'] === 'MultiLineString') {
    const coords = record['coordinates'];
    if (!Array.isArray(coords)) return false;
    for (const c of coords) {
      if (!Array.isArray(c)) return false;
      for (const cc of c) {
        if (!isGeoJsonPosition(cc)) return false;
      }
    }
    return true;
  } else if (record['type'] === 'Polygon') {
    const coords = record['coordinates'];
    if (!Array.isArray(coords)) return false;
    for (const c of coords) {
      if (!Array.isArray(c)) return false;
      for (const cc of c) {
        if (!isGeoJsonPosition(cc)) return false;
      }
    }
    return true;
  } else if (record['type'] === 'MultiPolygon') {
    const coords = record['coordinates'];
    if (!Array.isArray(coords)) return false;
    for (const c of coords) {
      if (!Array.isArray(c)) return false;
      for (const cc of c) {
        if (!Array.isArray(cc)) return false;
        for (const ccc of cc) {
          if (!isGeoJsonPosition(ccc)) return false;
        }
      }
    }
    return true;
  } else if (record['type'] === 'GeometryCollection') {
    const geoms = record['geometries'];
    if (!Array.isArray(geoms)) return false;
    for (const g of geoms) {
      if (!isGeoJsonGeometry(g)) return false;
    }
    return true;
  } else {
    return false;
  }
}

function isGeoJsonPosition(value: unknown): value is GeoJSON.Position {
  if (!Array.isArray(value)) return false;
  if (value.length !== 2 && value.length !== 3) return false;
  for (const v of value) {
    if (typeof v !== 'number') return false;
  }
  return true;
}

class RunningSummary {
  sum = 0;
  zeroCount = 0;
  nonzeroCount = 0;
  min: number | undefined = undefined;
  max: number | undefined = undefined;

  add(n: number): void {
    if (n === 0) {
      this.zeroCount++;
    } else {
      this.sum += n;
      this.nonzeroCount += 1;
      if (this.min === undefined || n < this.min) {
        this.min = n;
      }
      if (this.max === undefined || n > this.max) {
        this.max = n;
      }
    }
  }

  count(): number {
    return this.nonzeroCount + this.zeroCount;
  }

  mean(): number {
    const count = this.count();
    return count === 0 ? 0 : this.sum / count;
  }

  nonzeroMean(): number {
    const count = this.nonzeroCount;
    return count === 0 ? 0 : this.sum / count;
  }

  logTable(): void {
    console.table({
      count: this.nonzeroCount + this.zeroCount,
      nonzeroCount: this.nonzeroCount,
      zeroCount: this.zeroCount,
      nonzeroMin: this.min,
      max: this.max,
      nonzeroMean: this.nonzeroMean(),
      mean: this.mean(),
    });
  }
}

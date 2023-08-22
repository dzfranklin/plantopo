import stringOrd from '@/stringOrd';
import { DiGraphMap } from './DiGraphMap';
import { FPos } from './FPos';
import { SyncChange } from './SyncChange';
import { SyncOp } from './SyncOp';
import fracIdxBetween, { isFracIdx } from './fracIdxBetween';
import iterAll from '@/iterAll';
import { LAYERS } from '@/layers';

export interface FInsertPlace {
  at: 'before' | 'after' | 'firstChild';
  target: Fid;
}

export type LInsertPlace =
  | { at: 'first' }
  | { at: 'last' }
  | { at: 'before'; target: Lid }
  | { at: 'after'; target: Lid };

/** each `k` such that set(fid, k, v) -> {geoJsonFeature}.properties[k] = v */
const GEO_JSON_FPROPS: Set<Key> = new Set([]);

export type Fid = number;
export type Lid = number;
export type Key = string;
export type Value = unknown;
export type FracIdx = string;
export type FGeoJson = GeoJSON.Feature<GeoJSON.Geometry | null>;
export type RootGeoJson = GeoJSON.FeatureCollection<GeoJSON.Geometry | null>;

export type LPropListener<K extends keyof LPropTypeMap> = (
  v: LPropTypeMap[K],
) => void;
export type FPropListener<K extends keyof FPropTypeMap> = (
  v: FPropTypeMap[K],
) => void;
export type FChildOrderListener = (order: Array<Fid>) => void;
export type FGeoListener = (geo: RootGeoJson) => void;
/** `lid` should go visually between `before` and `after` such that after
 * appears on top of it */
export type LOrderOp =
  | {
      type: 'add';
      lid: number;
      before: number | undefined;
      after: number | undefined;
    }
  | { type: 'remove'; lid: number }
  | {
      type: 'move';
      lid: number;
      before: number | undefined;
      after: number | undefined;
    };
export type LOrderListener = (value: Array<Fid>, changes: LOrderOp[]) => void;
export type LPropsListener = (lid: Lid, key: Key, value: Value) => void;

type FData = {
  validProps: Map<Key, Value>;
  invalidProps?: Map<Key, Value>;
  propNotifier?: Map<
    Key,
    {
      notify: boolean;
      listeners: Set<FPropListener<string>>;
    }
  >;
  childOrderListeners?: Set<FChildOrderListener>;
  geoJson?: FGeoJson;
};

type LData = {
  validProps: Map<Key, Value>;
  invalidProps?: Map<Key, Value>;
  notifyProps?: Set<Key>;
  propListeners?: Map<Key, Set<LPropListener<string>>>;
};

const ROOT_FPOS: FPos = { parent: 0, idx: '' };

type FPropTypeMap = {
  pos: FPos;
  [k: string]: unknown;
};

type LPropTypeMap = {
  idx: FracIdx | null;
  opacity: number | null;
  [k: string]: unknown;
};

/**
 * # Notification order
 *
 * You will always be notified about order before props.
 *
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
    lOrderNotifies: new RunningSummary(),
  };

  private _transaction: Array<Array<SyncOp>> | null = null;

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
  private _lPropsListeners = new Set<LPropsListener>();
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

  // Public API - Mutate

  startTransaction(): void {
    if (this._transaction) {
      console.warn('startTransaction: Already in a transaction');
    } else {
      this._transaction = [];
    }
  }

  commitTransaction(): void {
    if (!this._transaction) {
      console.warn('commitTransaction: Not in a transaction');
    } else {
      const ops = [];
      for (const part of this._transaction) {
        for (const op of part) {
          ops.push(op);
        }
      }
      this._transaction = null;
      if (ops.length > 0) {
        this._apply(ops);
      }
    }
  }

  cancelTransaction(): void {
    if (!this._transaction) {
      console.warn('cancelTransaction: Not in a transaction');
    } else {
      this._transaction = null;
    }
  }

  /** Creates a feature, returning its fid */
  fCreate(place: FInsertPlace, props: Record<Key, Value> = {}): number {
    const resolved = this._fResolvePlace(place);
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
   * `pos` cannot be set (use `fMove`)
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

    const resolved = this._fResolvePlace(place);
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
   * `idx` cannot be set, use `lMove` instead.
   *
   * # Throws
   * If value is undefined or if a special property rule is violated.
   */
  lSet(lid: number, key: string, value: unknown): void {
    if (value === undefined) throw new Error('lSet: value cannot be undefined');
    if (key === 'idx') throw new Error('lSet: Cannot set idx');
    if (key === 'opacity' && !isLOpacity(value)) {
      throw new Error('lSet: invalid opacity');
    }
    this._apply([{ action: 'lSet', lid, key, value }]);
  }

  lMove(layers: number[], place: LInsertPlace): void {
    const resolved = this._lResolvePlace(place);
    let before = resolved.before;
    const after = resolved.after;
    const ops: SyncOp[] = [];
    for (const lid of layers) {
      const idx = fracIdxBetween(before, after);
      ops.push({ action: 'lSet', lid, key: 'idx', value: idx });
      before = idx;
    }
    this._apply(ops);
  }

  lRemove(lid: number): void {
    this._apply([{ action: 'lSet', lid, key: 'idx', value: null }]);
  }

  // Public API - Read

  /** Return value will be mutated. You must not mutate it. */
  fGeoJson(): RootGeoJson {
    return this._fGeoJson;
  }

  /** The value passed to the listener may be mutated after the listener
   * returns.
   */
  addFGeoJsonListener(cb: FGeoListener): FGeoListener {
    this._fGeoListeners.add(cb);
    return cb;
  }

  removeFGeoJsonListener(cb: FGeoListener) {
    this._fGeoListeners.delete(cb);
  }

  /** Get the value of a feature property
   *
   * Properties are never undefined, but (unless special) can be null.
   */
  fGet<K extends keyof FPropTypeMap>(
    fid: number,
    key: K,
  ): FPropTypeMap[K] | undefined {
    if (typeof key !== 'string') throw new Error('fProp: key must be a string');
    return this._fData.get(fid)?.validProps?.get(key) ?? null;
  }

  addFPropListener<K extends keyof FPropTypeMap>(
    fid: number,
    key: K,
    cb: FPropListener<K>,
  ): FPropListener<K> {
    if (typeof key !== 'string') throw new Error('fProp: key must be a string');
    const data = this._fData.get(fid);
    if (data === undefined) return cb;
    if (data.propNotifier === undefined) data.propNotifier = new Map();
    const entry = data.propNotifier.get(key);
    const erased = cb as FPropListener<string>;
    if (entry === undefined) {
      data.propNotifier.set(key, {
        notify: false,
        listeners: new Set([erased]),
      });
    } else {
      entry.listeners.add(erased);
    }
    return cb;
  }

  removeFPropListener<K extends keyof FPropTypeMap>(
    fid: number,
    key: K,
    cb: FPropListener<K>,
  ): void {
    if (typeof key !== 'string') throw new Error('key must be a string');
    this._fData
      .get(fid)
      ?.propNotifier?.get(key)
      ?.listeners?.delete(cb as FPropListener<string>);
  }

  lGet<K extends keyof LPropTypeMap>(
    lid: number,
    k: K,
  ): LPropTypeMap[K] | undefined {
    if (typeof k !== 'string') throw new Error('lProp: key must be a string');
    return this._lData.get(lid)?.validProps?.get(k) ?? null;
  }

  addLPropListener<K extends keyof LPropTypeMap>(
    lid: number,
    key: K,
    cb: LPropListener<K>,
  ): LPropListener<K> {
    if (typeof key !== 'string') throw new Error('lProp: key must be a string');
    const data = this._lData.get(lid);
    if (data === undefined) return cb;
    if (data.propListeners === undefined) data.propListeners = new Map();
    const entry = data.propListeners.get(key);
    const erased = cb as LPropListener<string>;
    if (entry === undefined) {
      data.propListeners.set(key, new Set([erased]));
    } else {
      entry.add(erased);
    }
    return cb;
  }

  removeLPropListener<K extends keyof LPropTypeMap>(
    lid: number,
    k: K,
    cb: LPropListener<K>,
  ): void {
    if (typeof k !== 'string') throw new Error('key must be string');
    this._lData
      .get(lid)
      ?.propListeners?.get(k)
      ?.delete(cb as LPropListener<string>);
  }

  addLPropsListener(cb: LPropsListener): LPropsListener {
    this._lPropsListeners.add(cb);
    return cb;
  }

  removeLPropsListener(cb: LPropsListener): void {
    this._lPropsListeners.delete(cb);
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

  addFChildOrderListener(
    fid: number,
    cb: FChildOrderListener,
  ): FChildOrderListener {
    const data = this._fData.get(fid);
    if (data === undefined) return cb;
    if (data.childOrderListeners === undefined) {
      data.childOrderListeners = new Set([cb]);
    } else {
      data.childOrderListeners.add(cb);
    }
    return cb;
  }

  removeFChildOrderListener(fid: number, cb: FChildOrderListener): void {
    this._fData.get(fid)?.childOrderListeners?.delete(cb);
  }

  lOrder(): Array<number> {
    return this._lOrder.map(({ lid }) => lid);
  }

  addLOrderListener(cb: LOrderListener): LOrderListener {
    this._lOrderListeners.add(cb);
    return cb;
  }

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

  private _fResolvePlace(place: FInsertPlace): {
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

  private _lResolvePlace(place: LInsertPlace): {
    before: FracIdx;
    after: FracIdx;
  } {
    let before = '';
    let after = '';
    if (place.at === 'first') {
      after = this._lOrder[0]?.idx || '';
    } else if (place.at === 'last') {
      before = this._lOrder.at(-1)?.idx || '';
    } else {
      const targetI = this._lOrder.findIndex((p) => p.lid === place.target);
      if (targetI < 0) {
        return this._lResolvePlace({ at: 'first' });
      }

      if (place.at === 'before') {
        if (targetI > 0) {
          before = this._lOrder[targetI - 1]!.idx;
        }
        after = this._lOrder[targetI]!.idx;
      } else if (place.at === 'after') {
        if (targetI < this._lOrder.length - 1) {
          after = this._lOrder[targetI + 1]!.idx;
        }
        before = this._lOrder[targetI]!.idx;
      } else {
        throw new Error('Unreachable');
      }
    }
    return { before, after };
  }

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
    if (this._transaction !== null) {
      this._transaction.push(ops);
    } else {
      this._popNotifies();
      this._send(ops);
    }
  }

  private _popNotifies(): void {
    this._updateSummary.count++;

    // Order - must fire before props

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

    if (this._notifyLOrderOps.length > 0) {
      const value = this.lOrder();
      const changes = Array.from(this._notifyLOrderOps);
      for (const l of this._lOrderListeners) l(value, changes);
      this._updateSummary.lOrderNotifies.add(1);
      this._notifyLOrderOps.length = 0;
    }

    // Props - must fire after order

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

    if (this._notifyFGeoJson) {
      const value = this._fGeoJson; // note not immutable
      for (const l of this._fGeoListeners) l(value);
      this._updateSummary.fGeoNotifies.add(1);
    } else {
      this._updateSummary.fGeoNotifies.add(0);
    }

    let lPropNotifyCount = 0;
    for (const lid of this._notifyLData) {
      const data = this._lData.get(lid);
      if (data === undefined) continue;
      if (data.notifyProps === undefined) continue;

      for (const k of data.notifyProps) {
        const v = data.validProps.get(k);

        for (const l of this._lPropsListeners) l(lid, k, v);

        const propListeners = data.propListeners?.get(k);
        if (propListeners !== undefined) {
          for (const l of propListeners) l(v);
        }

        lPropNotifyCount++;
      }
      data.notifyProps.clear();
    }
    this._notifyLData.clear();
    this._updateSummary.lPropNotifies.add(lPropNotifyCount);
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
    if (!(lid in LAYERS.layers)) {
      console.log('_lset: invalid as unknown layer');
      invalid = true;
    } else if (key === 'idx') {
      if (value !== null && !isFracIdx(value)) {
        throw new Error('_lSet: key=idx but value!==null && !isFracIdx(value)');
      } else if (
        this._lOrder.find((v) => v.idx === value && v.lid !== lid) !== undefined
      ) {
        console.log('_lset: invalid as idx collides');
        invalid = true;
      } else {
        const prevI = this._lOrder.findIndex((i) => i.lid === lid);
        if (prevI !== -1) {
          this._lOrder.splice(prevI, 1);
        }

        if (value === null) {
          if (prevI !== -1) {
            this._notifyLOrderOps.push({ type: 'remove', lid });
          }
        } else {
          this._lOrder.push({ lid, idx: value });
          this._lOrder.sort((a, b) => stringOrd(a.idx, b.idx));
          const newI = this._lOrder.findIndex((i) => i.lid === lid);
          const before = this._lOrder[newI - 1]?.lid;
          const after = this._lOrder[newI + 1]?.lid;

          if (prevI === -1) {
            this._notifyLOrderOps.push({ type: 'add', lid, before, after });
          } else {
            this._notifyLOrderOps.push({ type: 'move', lid, before, after });
          }
        }
      }
    } else if (key === 'opacity') {
      invalid = !isLOpacity(value);
      if (invalid) {
        console.log('_lset: invalid as !isLOpacity(value)', value);
      }
    }

    if (invalid) {
      console.warn('_lset: invalid', JSON.stringify({ lid, key, value }));
      if (data.invalidProps === undefined) {
        data.invalidProps = new Map([[key, value]]);
      } else {
        data.invalidProps.set(key, value);
      }
    } else {
      data.validProps.set(key, value);

      if (data.notifyProps === undefined) {
        data.notifyProps = new Set([key]);
      } else {
        data.notifyProps.add(key);
      }
      this._notifyLData.add(lid);
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

function isLOpacity(value: unknown): value is number {
  return (
    value === null || (typeof value === 'number' && value >= 0 && value <= 1)
  );
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

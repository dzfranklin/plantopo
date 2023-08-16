import { FPos } from './FPos';
import { SyncChange } from './SyncChange';
import { SyncOp } from './SyncOp';
import fracIdxBetween from './fracIdxBetween';

type FGeo = GeoJSON.Feature<GeoJSON.Geometry | null>;
type GeoRoot = GeoJSON.FeatureCollection<GeoJSON.Geometry | null>;

type PropListener = (v: unknown) => void;
/** order: fid[] */
type FChildrenListener = (order: number[]) => void;
type FGeoListener = (geo: GeoRoot) => void;
/** order: lid[] */
type LOrderListener = (order: number[]) => void;
type LPaintPropListener = (k: string, v: unknown) => void;

type LRenderOp =
  | {
      type: 'add';
      lid: number;
      /** Inside before `after`. */
      after: number | undefined;
      paintProps: Record<string, unknown>;
    }
  | { type: 'remove'; lid: number }
  | {
      type: 'move';
      lid: number;
      /** Move before `after`. */
      after: number | undefined;
    }
  | { type: 'setPaintProp'; lid: number; key: string; value: string };
type LRenderOpListener = (changes: LRenderOp[]) => void;

export class SyncEngine {
  readonly clientId: number;

  private _updateSummary = {
    count: 0,
    fPropDirty: new RunningSummary(),
    fChildrenDirty: new RunningSummary(),
    fGeoDirty: new RunningSummary(),
    lPropDirty: new RunningSummary(),
    lOrderDirty: new RunningSummary(),
    lRenderOpDirty: new RunningSummary(),
  };

  // Features

  private _fNextCounter = 1;

  private _fPropsUncorrected: Map<number, Map<string, unknown>> = new Map([
    [0, new Map()],
  ]);
  // If fPropsUncorrected[fid]['pos'] is invalid this has a transient fix
  private _fPos: Map<number, FPos> = new Map([[0, { parent: 0, idx: '' }]]);
  private _fPropDirty: Map<number, Set<string>> = new Map();
  private _fPropListeners: Map<number, Map<string, Set<PropListener>>> =
    new Map();

  /** Skips features with malformed or cylic pos */
  private _fChildrenUnordered: Map<number, Set<number>> = new Map([
    [0, new Set()],
  ]);
  private _fChildrenDirty: Set<number> = new Set();
  private _fChildrenListeners: Map<number, Set<FChildrenListener>> = new Map();

  private _fGeoRoot: GeoRoot = {
    type: 'FeatureCollection',
    features: [],
  };
  private _fGeo: Map<number, FGeo> = new Map();
  private _fGeoDirty = false;
  private _fGeoListeners: Set<FGeoListener> = new Set();

  // Layers

  private _lProps: Map<number, Map<string, unknown>> = new Map();
  private _lPropDirty: Map<number, Set<string>> = new Map();
  private _lPropListeners: Map<number, Map<string, Set<PropListener>>> =
    new Map();
  private _lPaintPropListeners: Map<number, Set<LPaintPropListener>> =
    new Map();

  private _lOrder: Array<{ lid: number; idx: string }> = [];
  private _lOrderDirty = false;
  private _lOrderListeners: Set<LOrderListener> = new Set();

  private _lDirtyRenderOps: Array<LRenderOp> = [];
  private _lRenderOpListeners: Set<LRenderOpListener> = new Set();

  /** throws if `clientId` is invalid */
  constructor(clientId: number) {
    if (
      clientId < 0 ||
      clientId > Math.pow(2, 16) - 1 ||
      !Number.isInteger(clientId)
    ) {
      throw new Error('Invalid client ID');
    }

    this.clientId = clientId;
  }

  // Public API - Debugging

  logUpdateSummary(): void {
    console.group('Update summary', new Date());

    console.info('clientId', this.clientId);
    console.info(this._updateSummary.count, 'updates');

    const groups: [string, RunningSummary][] = [
      ['fPropDirty', this._updateSummary.fPropDirty],
      ['fChildrenDirty', this._updateSummary.fChildrenDirty],
      ['geoDirty', this._updateSummary.fGeoDirty],
      ['lPropDirty', this._updateSummary.lPropDirty],
      ['lOrderDirty', this._updateSummary.lOrderDirty],
      ['lRenderOpDirty', this._updateSummary.lRenderOpDirty],
    ];
    for (const [label, summary] of groups) {
      console.groupCollapsed(label, summary.nonzeroCount);
      summary.logTable();
      console.groupEnd();
    }

    console.groupEnd();
  }

  // Public API - Mutate

  /** Creates a feature, returning its fid */
  createFeature(
    parent: number,
    before: number | undefined,
    after: number | undefined,
    props: Record<string, unknown> = {},
  ): number {
    const fid = this._allocateFid();

    let beforeIdx = '';
    if (before !== undefined) {
      const pos = this._fPos.get(before);
      if (pos === undefined) {
        console.warn('createFeature: unknown before fid', before);
      } else {
        beforeIdx = pos.idx;
      }
    }

    let afterIdx = '';
    if (after !== undefined) {
      const pos = this._fPos.get(after);
      if (pos === undefined) {
        console.warn('createFeature: unknown after fid', after);
      } else {
        afterIdx = pos.idx;
      }
    }

    const idx = fracIdxBetween(beforeIdx, afterIdx);
    const pos = { parent, idx };

    this.apply([
      {
        action: 'fCreate',
        fid,
        props: { ...props, pos },
      },
    ]);

    return fid;
  }

  /** Set a feature property
   *
   * Special properties:
   * - `pos`: Must implement `FPos`. Cannot be undefined. The root feature's pos
   *   cannot be changed.
   */
  fSet(fid: number, key: string, value: unknown): void {
    if (key === 'pos') {
      if (fid === 0) {
        throw new Error('Cannot change pos on root feature');
      }
      if (!isPosValue(value)) {
        throw new Error('Invalid pos value');
      }
    }

    this.apply([{ action: 'fSet', fid, key, value }]);
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
  moveFeatures(
    features: number[],
    parent: number,
    before: number | undefined,
    after: number | undefined,
  ): void {
    let beforeIdx = '';
    if (before !== undefined) {
      const pos = this._fPos.get(before);
      if (pos === undefined) {
        console.warn('moveFeatures: unknown before fid', before);
      } else {
        beforeIdx = pos.idx;
      }
    }

    let afterIdx = '';
    if (after !== undefined) {
      const pos = this._fPos.get(after);
      if (pos === undefined) {
        console.warn('moveFeatures: unknown after fid', after);
      } else {
        afterIdx = pos.idx;
      }
    }

    const ops: SyncOp[] = [];
    for (const fid of this.orderFeatures(features)) {
      const idx = fracIdxBetween(beforeIdx, afterIdx);
      ops.push({
        action: 'fSet',
        fid,
        key: 'pos',
        value: { parent, idx },
      });
      beforeIdx = idx;
    }

    this.apply(ops);
  }

  /** Set a layer property
   *
   * Special properties:
   * - `idx`: Must be a `string` frac idx or undefined
   */
  lSet(lid: number, key: string, value: unknown): void {
    this.apply([{ action: 'lSet', lid, key, value }]);
  }

  // Public API - Read

  addFGeoListener(listener: FGeoListener): void {
    this._fGeoListeners.add(listener);
  }

  removeFGeoListener(listener: FGeoListener) {
    this._fGeoListeners.delete(listener);
  }

  fProp(fid: number, k: string): unknown {
    if (k === 'pos') {
      return this._fPos.get(fid);
    } else {
      return this._fPropsUncorrected.get(fid)?.get(k);
    }
  }

  addFPropListener(fid: number, k: string, cb: PropListener): void {
    let fListeners = this._fPropListeners.get(fid);
    if (!fListeners) {
      this._fPropListeners.set(fid, (fListeners = new Map()));
    }

    let propListeners = fListeners.get(k);
    if (!propListeners) {
      fListeners.set(k, (propListeners = new Set()));
    }

    propListeners.add(cb);
  }

  removeFPropListener(fid: number, k: string, cb: PropListener): void {
    const fListeners = this._fPropListeners.get(fid);
    const propListeners = fListeners?.get(k);

    if (!fListeners || !propListeners) return;
    propListeners.delete(cb);

    if (propListeners.size === 0) {
      fListeners.delete(k);

      if (fListeners.size === 0) {
        this._fPropListeners.delete(fid);
      }
    }
  }

  lProp(lid: number, k: string): unknown {
    return this._lProps.get(lid)?.get(k);
  }

  addLPropListener(lid: number, k: string, cb: PropListener): void {
    let lListeners = this._lPropListeners.get(lid);
    if (!lListeners) {
      this._lPropListeners.set(lid, (lListeners = new Map()));
    }

    let propListeners = lListeners.get(k);
    if (!propListeners) {
      lListeners.set(k, (propListeners = new Set()));
    }

    propListeners.add(cb);
  }

  removeLPropListener(lid: number, k: string, cb: PropListener): void {
    const lListeners = this._lPropListeners.get(lid);
    const propListeners = lListeners?.get(k);

    if (!lListeners || !propListeners) return;
    propListeners.delete(cb);

    if (propListeners.size === 0) {
      lListeners.delete(k);

      if (lListeners.size === 0) {
        this._lPropListeners.delete(lid);
      }
    }
  }

  *lPaintProps(lid: number): Generator<[string, unknown]> {
    const props = this._lProps.get(lid);
    if (!props) return;

    for (const [k, v] of props) {
      if (k.startsWith('paint-')) {
        const subK = k.slice('paint-'.length);
        yield [subK, v];
      }
    }
  }

  addLPaintPropListener(lid: number, cb: LPaintPropListener): void {
    let listeners = this._lPaintPropListeners.get(lid);
    if (!listeners) {
      this._lPaintPropListeners.set(lid, (listeners = new Set()));
    }
    listeners.add(cb);
  }

  removeLPaintPropListener(lid: number, cb: LPaintPropListener): void {
    const listeners = this._lPaintPropListeners.get(lid);
    if (!listeners) return;
    listeners.delete(cb);

    if (listeners.size === 0) {
      this._lPaintPropListeners.delete(lid);
    }
  }

  addLRenderOpListener(cb: LRenderOpListener): void {
    this._lRenderOpListeners.add(cb);
  }

  removeLRenderOpListener(cb: LRenderOpListener): void {
    this._lRenderOpListeners.delete(cb);
  }

  /** Skips children with malformed or cylic pos */
  fChildren(fid: number): Array<number> {
    return Array.from(this._fChildrenUnordered.get(fid) || []).sort(
      (fidA, fidB) => {
        const aPos = this._fPos.get(fidA);
        const bPos = this._fPos.get(fidB);

        if (aPos === undefined) {
          console.error('Missing _fPos', fidA);
          return -1;
        } else if (bPos === undefined) {
          console.error('Missing _fPos', fidB);
          return 1;
        }

        if (aPos.idx < bPos.idx) return -1;
        if (aPos.idx > bPos.idx) return 1;
        return fidA - fidB;
      },
    );
  }

  addFChildrenListener(fid: number, cb: FChildrenListener): void {
    let fListeners = this._fChildrenListeners.get(fid);
    if (!fListeners) {
      this._fChildrenListeners.set(fid, (fListeners = new Set()));
    }
    fListeners.add(cb);
  }

  removeFChildrenListener(fid: number, cb: FChildrenListener): void {
    const fListeners = this._fChildrenListeners.get(fid);
    if (!fListeners) return;
    fListeners.delete(cb);
    if (fListeners.size === 0) {
      this._fChildrenListeners.delete(fid);
    }
  }

  lOrder(): Array<number> {
    return this._lOrder.map(({ lid }) => lid);
  }

  addLOrderListener(cb: LOrderListener): void {
    this._lOrderListeners.add(cb);
  }

  removeLOrderListener(cb: LOrderListener): void {
    this._lOrderListeners.delete(cb);
  }

  fHasAncestor(fid: number, preds: Set<number>): boolean {
    if (preds.has(fid)) return true;

    for (const ancestor of this.fAncestry(fid)) {
      if (preds.has(ancestor.fid)) return true;
    }

    return false;
  }

  *fAncestry(fid: number): Generator<{ fid: number; idx: string }> {
    const initialPos = this._fPos.get(fid);
    if (initialPos === undefined) throw new Error('Unreachable: missing _fPos');

    let cursor = initialPos.parent;
    do {
      const pos = this._fPos.get(cursor);
      if (pos === undefined) throw new Error('Unreachable: Missing _fPos');
      if (pos.parent === fid) throw new Error('Unreachable: _fPos cycle');

      yield { fid: cursor, idx: pos.idx };
      cursor = pos.parent;
    } while (cursor !== 0);
  }

  orderFeatures(features: Array<number>): Array<number> {
    const featureSet = new Set(features);

    const weighted = new Map<number, string[]>();
    outer: for (const fid of features) {
      if (weighted.has(fid)) continue;
      const weight: string[] = [];
      for (const ancestor of this.fAncestry(fid)) {
        if (featureSet.has(ancestor.fid)) {
          // Skip features inside features also included
          break outer;
        }
        weight.push(ancestor.idx);
      }
      weight.reverse();
      weighted.set(fid, weight);
    }

    return Array.from(weighted.entries())
      .sort(([fidA, weightA], [fidB, weightB]) => {
        for (let i = 0; i < Math.min(weightA.length, weightB.length); i++) {
          if (weightA[i] < weightB[i]) {
            return -1;
          }
          if (weightA[i] > weightB[i]) {
            return 1;
          }
        }

        if (weightA.length < weightB.length) {
          return -1;
        } else if (weightA.length > weightB.length) {
          return 1;
        }

        // Break ties with id
        if (fidA < fidB) {
          return -1;
        } else if (fidA > fidB) {
          return 1;
        } else {
          console.error(
            'orderFeatures: duplicated fids in sort should be impossible',
          );
          return 0;
        }
      })
      .map(([fid, _weight]) => fid);
  }

  // Public API - low level

  /**
   * All mutations in SyncEngine go through apply, allowing SyncSocket to
   * override and send to the server.
   */
  apply(ops: SyncOp[]): void {
    for (const op of ops) {
      switch (op.action) {
        case 'fCreate': {
          for (const [k, v] of Object.entries(op.props)) {
            this._fSet(op.fid, k, v);
          }
          break;
        }
        case 'fDelete': {
          this._fDelete(op.fids);
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
    this._didUpdate();
  }

  /** Never called by SyncEngine. SyncSocket calls for server changes. */
  change(change: SyncChange): void {
    for (const [fid, k, v] of change.fprops) {
      this._fSet(fid, k, v);
    }
    for (const [lid, k, v] of change.lprops) {
      this._lSet(lid, k, v);
    }
    this._fDelete(change.fdeletes);
    this._didUpdate();
  }

  // Private API

  private _allocateFid(): number {
    const counter = this._fNextCounter++;
    return this.clientId * Math.pow(2, 32) + counter;
  }

  private _didUpdate(): void {
    for (const [fid, propSet] of this._fPropDirty) {
      const lMap = this._fPropListeners.get(fid);
      if (lMap === undefined || lMap.size === 0) continue;

      for (const k of propSet) {
        const ls = lMap.get(k);
        if (ls === undefined || ls.size === 0) continue;

        const value = this.fProp(fid, k);
        for (const l of ls) {
          l(value);
        }
      }
    }
    this._updateSummary.fPropDirty.add(this._fPropDirty.size);
    this._fPropDirty.clear();

    for (const fid of this._fChildrenDirty) {
      const ls = this._fChildrenListeners.get(fid);
      if (ls === undefined || ls.size === 0) continue;

      const value = this.fChildren(fid);
      for (const l of ls) {
        l(value);
      }
    }
    this._updateSummary.fChildrenDirty.add(this._fChildrenDirty.size);
    this._fChildrenDirty.clear();

    if (this._fGeoDirty) {
      for (const l of this._fGeoListeners) {
        l(this._fGeoRoot);
      }
    }
    this._updateSummary.fGeoDirty.add(1);
    this._fGeoDirty = false;

    for (const [lid, propSet] of this._lPropDirty) {
      const propLMap = this._lPropListeners.get(lid);
      const paintLs = this._lPaintPropListeners.get(lid);
      if (
        (propLMap === undefined || propLMap.size === 0) &&
        (paintLs === undefined || paintLs.size === 0)
      ) {
        continue;
      }

      for (const k of propSet) {
        const propLs = propLMap?.get(k);
        const value = this._lProps.get(lid)?.get(k);

        if (propLs !== undefined) {
          for (const l of propLs) {
            l(value);
          }
        }

        if (k.startsWith('paint-') && paintLs !== undefined) {
          const subK = k.slice('paint-'.length);
          for (const l of paintLs) {
            l(subK, value);
          }
        }
      }
    }
    this._updateSummary.lPropDirty.add(this._lPropDirty.size);
    this._lPropDirty.clear();

    if (this._lOrderDirty) {
      const value = this.lOrder();
      for (const l of this._lOrderListeners) {
        l(value);
      }
    }
    this._lOrderDirty = false;
    this._updateSummary.lOrderDirty.add(1);

    if (this._lDirtyRenderOps.length > 0) {
      for (const l of this._lRenderOpListeners) {
        l(this._lDirtyRenderOps);
      }
    }
    this._lDirtyRenderOps.length = 0;
    this._updateSummary.lRenderOpDirty.add(1);
  }

  private _fSet(fid: number, key: string, value: unknown): void {
    let oldValue: unknown;
    const uncorrectedMap = this._fPropsUncorrected.get(fid);
    if (uncorrectedMap) {
      oldValue = uncorrectedMap.get(key);
      uncorrectedMap.set(key, value);
    } else {
      this._fPropsUncorrected.set(fid, new Map([[key, value]]));
    }

    const dirtySet = this._fPropDirty.get(fid);
    if (dirtySet === undefined) {
      this._fPropDirty.set(fid, new Set([key]));
    } else {
      dirtySet.add(key);
    }

    if (key === 'pos') {
      if (oldValue !== undefined) {
        if (isPosValue(oldValue)) {
          this._fChildrenDirty.add(oldValue.parent);
          this._fChildrenUnordered.get(oldValue.parent)?.delete(fid);
        } else {
          console.error('_fset: invalid old pos value', fid, oldValue);
        }
      }

      if (isPosValue(value)) {
        if (this._wouldCycle(fid, value.parent)) {
          console.info('_fset: would cycle', fid, value);
        } else {
          this._fChildrenDirty.add(value.parent);

          const set = this._fChildrenUnordered.get(value.parent);
          if (set === undefined) {
            this._fChildrenUnordered.set(value.parent, new Set([fid]));
          } else {
            set.add(fid);
          }
        }
      } else {
        console.error('_fset: invalid pos', fid, value);
      }
    }

    // Update geo

    let geo = this._fGeo.get(fid);
    if (!geo) {
      geo = {
        id: fid,
        type: 'Feature',
        geometry: null,
        properties: null,
      };
      this._fGeoRoot.features.push(geo);
      this._fGeoDirty = true;
    }

    if (key === 'geometry') {
      geo.geometry = value as GeoJSON.Geometry;
      this._fGeoDirty = true;
    } else if (key !== 'pos') {
      if (geo.properties == null) geo.properties = {};
      geo.properties[key] = value;
      this._fGeoDirty = true;
    }
  }

  /**
   * Calls `this.apply` if necessary to converge
   */
  private _fDelete(fids: number[]): void {
    const incomingSet = new Set(fids);
    const outgoingSet = new Set<number>();

    const deleteLocally = new Set<number>();
    for (const fid of incomingSet) {
      if (deleteLocally.has(fid)) continue;

      if (!this._fPos.has(fid)) {
        // If it doesn't exist locally we don't need to do anything
        continue;
      }

      deleteLocally.add(fid);

      for (const descendant of this._fDescendants(fid)) {
        if (deleteLocally.has(descendant)) break;

        // We won't iterate past `descendant` again for this `fid` so the fact
        // we add prematurely before we walk the remaining descendents is ok.
        deleteLocally.add(descendant);

        if (!incomingSet.has(descendant)) {
          outgoingSet.add(descendant);
        }
      }
    }

    for (const fid of deleteLocally) {
      const pos = this._fPos.get(fid);
      if (pos === undefined) {
        throw new Error('Unreachable: missing fid pos');
      }

      this._fChildrenDirty.add(pos.parent);
      this._fPos.delete(fid);
      this._fPropsUncorrected.delete(fid);
      this._fChildrenUnordered.get(pos.parent)?.delete(fid);
      this._fGeo.delete(fid);
    }

    this._fGeoRoot.features = this._fGeoRoot.features.filter((fGeo) => {
      if (typeof fGeo.id !== 'number') {
        throw new Error('Unreachable: fGeo.id not a number');
      }
      return !deleteLocally.has(fGeo.id);
    });
  }

  private *_fDescendants(fid: number): Generator<number> {
    const initialChildren = this._fChildrenUnordered.get(fid);
    if (initialChildren === undefined || initialChildren.size === 0) {
      return;
    }

    const stack = [new Set(initialChildren)];

    while (stack.length > 0) {
      if (stack.length > 100_000) {
        throw new Error('Unreachable: Stack overflow computing _fDescendants');
      }

      const children = stack.at(-1)!;

      let cursor: number;
      const nextCursor = children.values().next();
      if (nextCursor.done) {
        stack.pop();
        continue;
      } else {
        cursor = nextCursor.value;
        children.delete(cursor);
      }

      yield cursor;

      const cursorChildren = this._fChildrenUnordered.get(cursor);
      if (cursorChildren !== undefined && cursorChildren.size > 0) {
        stack.push(new Set(cursorChildren));
      }
    }
  }

  /**
   * Would reparenting `fid` under `newParent` cause a cycle?
   *
   * Note a reparent can't create an orphan given a valid status quo without a
   * cycle.
   */
  private _wouldCycle(fid: number, newParent: number): boolean {
    if (newParent === fid) {
      return true;
    }

    // If newParent is not a descendant of fid there is no cycle

    for (const descendant of this._fDescendants(fid)) {
      if (descendant === newParent) {
        return true;
      }
    }

    return false;
  }

  private _lSet(lid: number, key: string, value: unknown): void {
    const props = this._lProps.get(lid);
    if (props) {
      props.set(key, value);
    } else {
      this._lProps.set(lid, new Map([[key, value]]));
    }

    const dirtySet = this._lPropDirty.get(lid);
    if (dirtySet) {
      dirtySet.add(key);
    } else {
      this._lPropDirty.set(lid, new Set([key]));
    }

    if (key === 'idx') {
      const prevI = this._lOrder.findIndex((l) => l.lid === lid);
      if (prevI !== -1) {
        this._lOrder.splice(prevI, 1);
      }

      let after: number | undefined;
      if (value !== undefined) {
        this._lOrder.push({ lid, idx: value as string });
        this._lOrder.sort((a, b) => {
          if (a.idx < b.idx) return -1;
          if (a.idx > b.idx) return 1;
          return 0;
        });

        const newI = this._lOrder.findIndex((l) => l.lid === lid);
        after = this._lOrder[newI]?.lid;
      }

      this._lOrderDirty = true;

      if (value === undefined) {
        this._lDirtyRenderOps.push({ type: 'remove', lid });
      } else if (prevI === -1) {
        const paintProps: Record<string, unknown> = {};
        for (const [k, v] of this.lPaintProps(lid)) {
          paintProps[k] = v;
        }

        this._lDirtyRenderOps.push({
          type: 'add',
          lid,
          after,
          paintProps,
        });
      } else {
        this._lDirtyRenderOps.push({ type: 'move', lid, after });
      }
    }
  }
}

const isPosValue = (value: unknown): value is FPos =>
  !!value &&
  typeof value === 'object' &&
  typeof (value as Record<string, unknown>)['parent'] === 'number' &&
  typeof (value as Record<string, unknown>)['idx'] === 'string';

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

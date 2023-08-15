import { SyncChange } from './SyncChange';
import { SyncOp } from './SyncOp';

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

/** The 'pos' key of a feature is always present with this shape */
interface FPos {
  parent: number;
  idx: string;
}

export class SyncEngine {
  // Features

  private _fProps: Map<number, Map<string, unknown>> = new Map([
    [0, new Map()],
  ]);
  private _fPropDirty: Map<number, Set<string>> = new Map();
  private _fPropListeners: Map<number, Map<string, Set<PropListener>>> =
    new Map();

  private _fChildrenUnordered: Map<number, Set<number>> = new Map([
    [0, new Set()],
  ]);
  private _fChildrenDirty: Set<number> = new Set();
  private _fChildrenListeners: Map<number, Set<FChildrenListener>> = new Map();

  geoRoot: GeoRoot = {
    type: 'FeatureCollection',
    features: [],
  };
  private _fGeo: Map<number, GeoJSON.Feature<GeoJSON.Geometry | null>> =
    new Map();
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

  fProp(fid: number, k: string): unknown {
    return this._fProps.get(fid)?.get(k);
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

  fChildren(fid: number): Array<number> {
    return Array.from(this._fChildrenUnordered.get(fid) || []).sort(
      (fidA, fidB) => {
        const aPos = this._fProps.get(fidA)?.get('pos');
        const bPos = this._fProps.get(fidB)?.get('pos');

        if (aPos === undefined || !isPosValue(aPos)) {
          return -1;
        } else if (bPos === undefined || !isPosValue(bPos)) {
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
      if (preds.has(ancestor.parent)) return true;
    }

    return false;
  }

  *fAncestry(fid: number) {
    let cursor = fid;
    while (cursor !== 0) {
      const pos = this._fProps.get(cursor)?.get('pos');
      if (!isPosValue(pos)) {
        console.warn('ancestors: invalid pos', cursor, pos);
        return false;
      }

      if (pos.parent === fid) {
        console.warn('orderFeatures: loop detected', fid);
        return false;
      }

      cursor = pos.parent;
      yield pos;
    }
    return true;
  }

  apply(ops: SyncOp[]): void {
    for (const op of ops) {
      switch (op.action) {
        case 'fCreate': {
          this._fSet(op.fid, 'pos', op.pos);
          break;
        }
        case 'fDelete': {
          this._fDelete(op.fid);
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

  change(change: SyncChange): void {
    for (const [fid, k, v] of change.featureProps) {
      this._fSet(fid, k, v);
    }
    for (const [lid, k, v] of change.layerProps) {
      this._lSet(lid, k, v);
    }
    for (const fid of change.deletedFeatures) {
      this._fDelete(fid);
    }
    this._didUpdate();
  }

  moveFeatures(
    features: number[],
    parent: number,
    before: number | undefined,
    after: number | undefined,
  ): void {
    const orderedFeatures = this.orderFeatures(features);
    const ops: SyncOp[] = [];

    let nextBeforeIdx: string | undefined;
    if (before !== undefined) {
      const pos = this._fProps.get(before)?.get('pos');
      if (isPosValue(pos)) {
        nextBeforeIdx = pos.idx;
      } else {
        console.warn('moveFeatures: before has invalid pos', { before, pos });
      }
    }

    for (const fid of orderedFeatures) {
      ops.push({
        action: 'fSet',
        fid,
        key: 'pos',
        value: { parent, idx },
      });
    }

    this.apply(ops);
  }

  orderFeatures(features: Array<number>): Array<number> {
    const featureSet = new Set(features);

    const weighted = new Map<number, string[]>();
    outer: for (const fid of features) {
      if (weighted.has(fid)) continue;
      let weight: string[] = [];

      const ancestry = this.fAncestry(fid);
      let curr = ancestry.next();
      while (!curr.done) {
        if (featureSet.has(curr.value.parent)) {
          // Skip features inside features also included
          break outer;
        }

        weight.push(curr.value.idx);
        curr = ancestry.next();
      }
      if (!curr.value) {
        // Failed to reach root
        weight = ['x'];
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

  private _didUpdate(): void {
    for (const [fid, propSet] of this._fPropDirty) {
      const lMap = this._fPropListeners.get(fid);
      if (lMap === undefined || lMap.size === 0) continue;

      for (const k of propSet) {
        const ls = lMap.get(k);
        if (ls === undefined || ls.size === 0) continue;

        const value = this._fProps.get(fid)?.get(k);

        for (const l of ls) {
          l(value);
        }
      }
    }
    this._fPropDirty.clear();

    for (const [fid, listeners] of this._fChildrenListeners) {
      const value = this.fChildren(fid);
      for (const l of listeners) {
        l(value);
      }
    }
    this._fChildrenDirty.clear();

    if (this._fGeoDirty) {
      for (const l of this._fGeoListeners) {
        l(this.geoRoot);
      }
    }

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

    if (this._lOrderDirty) {
      const value = this.lOrder();
      for (const l of this._lOrderListeners) {
        l(value);
      }
    }

    if (this._lDirtyRenderOps.length > 0) {
      for (const l of this._lRenderOpListeners) {
        l(this._lDirtyRenderOps);
      }
    }
  }

  /**
   * Updates `_fProps`, `_fChildren`, and `_fOrderDirty`
   */
  private _fSet(fid: number, key: string, value: unknown): void {
    let oldValue: unknown;
    const props = this._fProps.get(fid);
    if (props) {
      oldValue = props.get(key);
      props.set(key, value);
    } else {
      this._fProps.set(fid, new Map([[key, value]]));
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
        this._fChildrenDirty.add(fid);

        const set = this._fChildrenUnordered.get(value.parent);
        if (set === undefined) {
          this._fChildrenUnordered.set(value.parent, new Set([fid]));
        } else {
          set.add(fid);
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
      this.geoRoot.features.push(geo);
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
   * Updates `_fProps`, `_fChildren`, and `_fOrderDirty`
   */
  private _fDelete(fid: number): void {
    const props = this._fProps.get(fid);
    if (!props) {
      return;
    }

    const pos = props.get('pos');
    if (pos && isPosValue(pos)) {
      this._fChildrenDirty.add(pos.parent);
      this._fChildrenUnordered.get(pos.parent)?.delete(fid);
    }

    this._fProps.delete(fid);
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

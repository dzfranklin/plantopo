import stringOrd from '@/generic/stringOrd';
import { DiGraphMap } from '../DiGraphMap';
import {
  FGeometry,
  FPos,
  FracIdx,
  LIdx,
  LOpacity,
  isFGeometry,
  isFPos,
  isLOpacity,
} from '../propTypes';
import { SyncChange } from '../SyncChange';
import { SyncOp } from '../SyncOp';
import fracIdxBetween, { isFracIdx } from '../fracIdxBetween';
import iterAll from '@/generic/iterAll';
import { LayerSource, MapSources } from '../mapSources';
import { PropMap } from './PropMap';
import {
  EMPTY_SCENE,
  SceneFInsertPlace,
  InactiveSceneLayer,
  Scene,
  SceneFeature,
  SceneLayer,
  SceneRootFeature,
} from './Scene';
import { Presence } from '../Presence';

export type LInsertPlace =
  | { at: 'first' }
  | { at: 'last' }
  | { at: 'before'; target: Lid }
  | { at: 'after'; target: Lid };

type Fid = number;
type Lid = number;
type ClientId = string;
type Key = string;
type Value = unknown;

/**
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
  readonly canEdit: boolean;
  readonly clientId: ClientId;

  /** A reliably abstraction over delivering messages */
  private _send: ((_: SyncOp[]) => void) | null;

  /** if null, no current transaction. Otherwise contains data to commit.
   * Just push another array of SyncOps to add to the current transaction.
   */
  private _transaction: Array<Array<SyncOp>> | null = null;

  private _scene = EMPTY_SCENE;
  private _sceneFNodes = new Map<number, SceneFeature>();
  private _sceneDirty = false;

  /** The start fid block we're currently allocated by the server */
  private _fidBlockStart: number;
  /** One after the last fid we can allocate in our block */
  private _fidBlockUntil: number;
  /** The upcoming fid to allocate */
  private _nextFid: Fid;

  private _mapSources: MapSources;

  private _f = new PropMap();
  private _l = new PropMap();
  private _fTree = new DiGraphMap<FracIdx>();

  private _fSelectedByMe = new Set<Fid>();
  private _fSelectedByPeers: Map<Fid, Set<ClientId>> = new Map();
  private _lSelectedByMe = new Set<Lid>();
  private _lSelectedByPeers: Map<Lid, Set<ClientId>> = new Map();

  // Debug statistics
  private _renderCount = 0;

  constructor(props: {
    mapSources: MapSources;
    clientId: ClientId;
    fidBlockStart: Fid;
    fidBlockUntil: Fid;
    canEdit: boolean;
    send: ((_: SyncOp[]) => void) | null;
  }) {
    if (props.fidBlockUntil <= props.fidBlockStart) {
      throw new Error('Invalid fid block');
    }
    this._mapSources = props.mapSources;
    this.clientId = props.clientId;
    this._fidBlockStart = props.fidBlockStart;
    this._fidBlockUntil = props.fidBlockUntil;
    this._nextFid = props.fidBlockStart;
    this.canEdit = props.canEdit;
    this._send = props.send;
  }

  logDebug() {
    console.groupCollapsed('SyncEngine');
    console.log('canEdit', this.canEdit);
    console.log('fidBlock', `[${this._fidBlockStart}, ${this._fidBlockUntil})`);
    console.log('nextFid', this._nextFid);
    console.log('render count', this._renderCount);
    console.log('sceneDirty', this._sceneDirty);
    console.groupEnd();
  }

  render(): Scene {
    if (!this._sceneDirty) {
      return this._scene;
    } else if (this._transaction) {
      // Don't show changes until the transaction is committed
      return this._scene;
    } else {
      this._scene = {
        layers: this._renderLayers(),
        features: this._renderFeatures(),
      };
      this._sceneDirty = false;
      this._renderCount++;
      return this._scene;
    }
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
    this._sceneDirty = true;
    if (convergeDeletes !== undefined) {
      this._send?.([
        { action: 'fDeleteConverge', fids: Array.from(convergeDeletes) },
      ]);
    }
  }

  /** All mutations go through. **Mutates its arguments** */
  apply(ops: SyncOp[]) {
    if (!this.canEdit) {
      throw new Error('Cannot edit');
    }

    for (let i = 0; i < ops.length; i++) {
      const op = ops[i]!;
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
      this._sceneDirty = true;
      this._send!(ops);
    }
  }

  presence(): Presence {
    return {
      clientId: this.clientId,
      selectedFeatures: Array.from(this._fSelectedByMe),
      selectedLayers: Array.from(this._lSelectedByMe),
    };
  }

  receivePeerPresence(presence: Presence): void {
    for (const fid of presence.selectedFeatures) {
      let set = this._fSelectedByPeers.get(fid);
      if (set === undefined) {
        set = new Set();
        this._fSelectedByPeers.set(fid, set);
      }
      set.add(presence.clientId);
    }

    for (const lid of presence.selectedLayers) {
      let set = this._lSelectedByPeers.get(lid);
      if (set === undefined) {
        set = new Set();
        this._lSelectedByPeers.set(lid, set);
      }
      set.add(presence.clientId);
    }
  }

  startTransaction(): void {
    if (this._transaction) {
      console.info('startTransaction: Already in a transaction');
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
        this.apply(ops);
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

  fParent(fid: Fid): Fid | undefined {
    if (fid === 0) return 0;
    for (const parent of this._fTree.incomingNeighbors(fid)) {
      return parent;
    }
  }

  fHasAncestor(fid: Fid, preds: Set<number>): boolean {
    if (preds.has(fid)) return true;
    if (preds.has(0)) return true;

    let parent = this.fParent(fid);
    while (parent !== undefined && parent !== 0) {
      if (preds.has(parent)) return true;
      parent = this.fParent(parent);
    }

    return false;
  }

  fLookupSceneNode(fid: Fid): SceneFeature | undefined {
    return this._sceneFNodes.get(fid);
  }

  /** Creates a feature, returning its fid */
  fCreate(props: Record<Key, Value> = {}): number {
    const resolved = this._fResolvePlace(this._scene.features.insertPlace);
    const idx = fracIdxBetween(resolved.before, resolved.after);
    const fid = this._allocateFid();
    this.apply([
      {
        action: 'fCreate',
        fid,
        props: { ...props, pos: { parent: resolved.parent, idx } },
      },
    ]);
    return fid;
  }

  fSetName(fid: Fid, name: string): void {
    this.apply([{ action: 'fSet', fid, key: 'name', value: name }]);
  }

  fIsSelectedByMe(fid: Fid): boolean {
    return this._fSelectedByMe.has(fid);
  }

  fHasAncestorSelectedByMe(fid: Fid): boolean {
    const parent = this.fParent(fid);
    if (parent === undefined || parent === 0) return false;
    if (this.fIsSelectedByMe(parent)) return true;
    return this.fHasAncestorSelectedByMe(parent);
  }

  fAddToMySelection(fid: Fid): void {
    this._fSelectedByMe.add(fid);
    this._sceneDirty = true;
  }

  fRemoveFromMySelection(fid: Fid): void {
    this._fSelectedByMe.delete(fid);
    this._sceneDirty = true;
  }

  fToggleSelectedByMe(fid: Fid): void {
    if (this.fIsSelectedByMe(fid)) {
      this.fRemoveFromMySelection(fid);
    } else {
      this.fAddToMySelection(fid);
    }
  }

  fReplaceMySelection(fid: Fid): void {
    this._fSelectedByMe.clear();
    this._fSelectedByMe.add(fid);
    this._sceneDirty = true;
  }

  fClearMySelection(): void {
    this._fSelectedByMe.clear();
    this._sceneDirty = true;
  }

  fMoveSelectedByMe(place: SceneFInsertPlace): void {
    const features = this._fComputeSelectedByMeForMove();

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
    this.apply(ops);
  }

  private _fComputeSelectedByMeForMove(start: Fid = 0, out: Fid[] = []): Fid[] {
    const node = this.fLookupSceneNode(start);
    if (!node) return out;
    for (const child of node.children) {
      if (child.selectedByMe) {
        out.push(child.id);
      } else {
        this._fComputeSelectedByMeForMove(child.id, out);
      }
    }
    return out;
  }

  /** Recursively delete each feature and all its descendants */
  fDelete(fids: Fid[]): void {
    this.apply([{ action: 'fDelete', fids }]);
  }

  lSetOpacity(lid: Lid, opacity: number | null): void {
    this.apply([{ action: 'lSet', lid, key: 'opacity', value: opacity }]);
  }

  lIsSelectedByMe(lid: Lid): boolean {
    return this._lSelectedByMe.has(lid);
  }

  lAddToMySelection(lid: Lid): void {
    this._lSelectedByMe.add(lid);
    this._sceneDirty = true;
  }

  lRemoveFromMySelection(lid: Lid): void {
    this._lSelectedByMe.delete(lid);
    this._sceneDirty = true;
  }

  lToggleSelectedByMe(lid: Lid): void {
    if (this.lIsSelectedByMe(lid)) {
      this.lRemoveFromMySelection(lid);
    } else {
      this.lAddToMySelection(lid);
    }
  }

  lReplaceMySelection(lid: Lid): void {
    this._lSelectedByMe.clear();
    this._lSelectedByMe.add(lid);
    this._sceneDirty = true;
  }

  lClearMySelection(): void {
    this._lSelectedByMe.clear();
    this._sceneDirty = true;
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
    this.apply(ops);
  }

  lRemove(lid: Lid): void {
    console.log('lRemove', lid);
    this.apply([{ action: 'lSet', lid, key: 'idx', value: null }]);
  }

  // Private API

  private _renderLayers(): Scene['layers'] {
    const active: SceneLayer[] = [];
    const activeSet = new Set<LayerSource>();
    for (const [lid, props] of this._l) {
      const idx = props.get('idx') as LIdx;
      if (!idx) continue;

      const opacity = props.get('opacity') as LOpacity;
      const source = this._mapSources.layers[lid]!;

      const selectedByMe = this._lSelectedByMe.has(lid);
      const selectedByPeers = this._lPeersWhoSelected(lid);

      active.push({
        id: lid,
        idx,
        source,
        opacity,
        selectedByMe,
        selectedByPeers,
      });
      activeSet.add(source);
    }
    active.sort((a, b) => stringOrd(a.idx, b.idx));

    const inactive: InactiveSceneLayer[] = [];
    for (const source of Object.values(this._mapSources.layers)) {
      if (activeSet.has(source)) continue;

      const selectedByMe = this._lSelectedByMe.has(source.lid);
      const selectedByPeers = this._lPeersWhoSelected(source.lid);

      inactive.push({ id: source.lid, source, selectedByMe, selectedByPeers });
    }
    inactive.sort((a, b) => stringOrd(a.source.name, b.source.name));

    return { active, inactive };
  }

  private _renderFeatures(): Scene['features'] {
    this._sceneFNodes.clear();

    const root: SceneRootFeature = {
      id: 0,
      parent: null,
      children: [],
    };

    const ctx: FRenderCtx = {
      insertPlace: {
        at: 'firstChild',
        target: root,
      },
    };

    for (const fid of this._fTree.neighbors(0)) {
      const feature = this._renderFeature(ctx, root, fid);
      root.children.push(feature);
    }
    root.children.sort((a, b) => stringOrd(a.idx, b.idx));

    return {
      root,
      insertPlace: ctx.insertPlace,
    };
  }

  private _renderFeature(
    ctx: FRenderCtx,
    parent: SceneFeature | SceneRootFeature,
    fid: Fid,
  ): SceneFeature {
    const idx = this._fTree.edgeWeight(parent.id, fid)!;
    const props = this._f.props(fid)!;

    const name = props.get('name') as string | null;
    const geometry = props.get('geometry') as FGeometry | null;
    const color = props.get('color') as string | null;

    const selectedByMe = this._fSelectedByMe.has(fid);
    const selectedByPeers = this._fPeersWhoSelected(fid);

    const feature: SceneFeature = {
      id: 0,
      parent,
      idx,
      children: [],
      geometry,
      name,
      color,
      selectedByMe,
      selectedByPeers,
    };
    this._sceneFNodes.set(fid, feature);

    const childFids = Array.from(this._fTree.neighbors(fid));

    if (selectedByMe) {
      // The insertPlace should be the selected feature visually closest to the
      // bottom. If anyone is below us they'll overwrite as we're doing a depth
      // first search
      ctx.insertPlace = {
        at: childFids.length > 0 ? 'firstChild' : 'after',
        target: feature,
      };
    }

    for (const childFid of childFids) {
      const child = this._renderFeature(ctx, feature, childFid);
      feature.children.push(child);
    }
    feature.children.sort((a, b) => stringOrd(a.idx, b.idx));

    return feature;
  }

  private _lPeersWhoSelected(lid: Lid): string[] | null {
    const set = this._lSelectedByPeers.get(lid);
    if (!set) return null;
    return Array.from(set);
  }

  private _fPeersWhoSelected(fid: Fid): string[] | null {
    const set = this._fSelectedByPeers.get(fid);
    if (!set) return null;
    return Array.from(set);
  }

  private _fResolvePlace(place: SceneFInsertPlace): {
    parent: number;
    before: FracIdx;
    after: FracIdx;
  } {
    let parent: number;
    let before = '';
    let after = '';
    if (place.at === 'firstChild') {
      parent = place.target.id;
      after = place.target.children[0]?.idx ?? '';
    } else if (place.at === 'before') {
      parent = place.target.parent.id;
      after = place.target.idx;
      const sibs = place.target.parent.children;
      before = sibs[sibs.indexOf(place.target) - 1]?.idx ?? '';
    } else if (place.at === 'after') {
      parent = place.target.parent.id;
      before = place.target.idx;
      const sibs = place.target.parent.children;
      after = sibs[sibs.indexOf(place.target) + 1]?.idx ?? '';
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
    const order = this._lOrder();
    if (place.at === 'first') {
      after = order[0]?.idx || '';
    } else if (place.at === 'last') {
      before = order.at(-1)?.idx || '';
    } else {
      const targetI = order.findIndex((p) => p.lid === place.target);
      if (targetI < 0) {
        return this._lResolvePlace({ at: 'first' });
      }

      if (place.at === 'before') {
        if (targetI > 0) {
          before = order[targetI - 1]!.idx;
        }
        after = order[targetI]!.idx;
      } else if (place.at === 'after') {
        if (targetI < order.length - 1) {
          after = order[targetI + 1]!.idx;
        }
        before = order[targetI]!.idx;
      } else {
        throw new Error('Unreachable');
      }
    }
    return { before, after };
  }

  private _lOrder(): Array<{ lid: Lid; idx: string }> {
    const order: Array<{ lid: Lid; idx: string }> = [];
    for (const [lid, props] of this._l) {
      const idx = props.get('idx') as LIdx;
      if (!idx) continue;
      order.push({ lid, idx });
    }
    order.sort((a, b) => stringOrd(a.idx, b.idx));
    return order;
  }

  /** Set a property on a feature
   *
   * Acts locally. Enqueues notifications
   */
  private _fSet(fid: Fid, key: string, value: unknown): void {
    // VALIDATE

    let valid;
    if (key === 'pos') {
      if (!isFPos(value)) {
        throw new Error('_fSet: key=pos but !isPosValue(value');
      }

      if (fid === 0) {
        if (value.parent !== 0 || value.idx !== '') {
          throw new Error('_fSet: invalid pos for root');
        }
        // We already have the right materialized values
        valid = true;
      } else if (this._wouldCycle(fid, value.parent)) {
        console.log('_fset: invalid as would cycle', fid, '<-', value.parent);
        valid = false;
      } else {
        valid = true;
      }
    } else if (key === 'geometry') {
      if (value && !isFGeometry(value)) {
        throw new Error('_fSet: key=geometry but value && !isFGeometry(value');
      } else {
        valid = true;
      }
    }

    // MUTATE

    if (valid) {
      this._sceneDirty = true;

      if (key === 'pos' && fid !== 0) {
        const pos = value as FPos; // value = true
        const oldParent = this.fParent(fid);
        if (oldParent !== undefined) {
          if (pos.parent === oldParent) {
            this._fTree.replaceEdgeWeight(pos.parent, fid, pos.idx);
          } else {
            this._fTree.removeEdge(oldParent, fid);
            this._fTree.addEdge(pos.parent, fid, pos.idx);
          }
        } else {
          this._fTree.addEdge(pos.parent, fid, pos.idx);
        }
      }

      this._f.propsOrInit(fid).set(key, value);
    } else {
      this._f.propsOrInit(fid).setInvalid(key, value);
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
      this._f.delete(fid);
      this._fTree.removeNode(fid);
      this._fSelectedByMe.delete(fid);
    }

    return convergeDeletes;
  }

  /**
   * Would reparenting `fid` under `newParent` cause a cycle?
   *
   * Note a reparent can't create an orphan given a valid status quo without a
   * cycle.
   */
  private _wouldCycle(fid: Fid, newParent: number): boolean {
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
  private _lSet(lid: Lid, key: string, value: unknown): void {
    // VALIDATE

    let valid;
    if (!(lid in this._mapSources.layers)) {
      console.log('_lset: invalid as unknown layer', lid, value);
      valid = false;
    } else if (key === 'idx') {
      if (value === null) {
        valid = true;
      } else if (!isFracIdx(value)) {
        throw new Error('_lSet: key=idx but value!==null && !isFracIdx(value)');
      } else if (this._lWouldCollide(lid, value)) {
        console.log('_lset: _lWouldCollide', lid, value);
        valid = false;
      } else {
        valid = true;
      }
    } else if (key === 'opacity') {
      if (value === null || isLOpacity(value)) {
        valid = true;
      } else {
        console.log('_lset: invalid opacity', value);
        valid = false;
      }
    }

    // MUTATE

    if (valid) {
      this._l.propsOrInit(lid).set(key, value);
    } else {
      this._l.propsOrInit(lid).setInvalid(key, value);
    }
  }

  private _lWouldCollide(lid: Lid, idx: string | null): boolean {
    if (typeof idx !== 'string') return false;
    for (const [pLid, pProps] of this._l) {
      if (pLid === lid) continue;
      const pIdx = pProps.get('idx') as LIdx;
      if (pIdx === idx) return true;
    }
    return false;
  }

  private _allocateFid(): number {
    if (this._nextFid < this._fidBlockUntil) {
      return this._nextFid++;
    } else {
      throw new Error('out of fids');
    }
  }
}

type FRenderCtx = { insertPlace: SceneFInsertPlace };

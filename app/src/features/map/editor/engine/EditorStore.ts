import stringOrd from '@/generic/stringOrd';
import { Changeset } from '../api/Changeset';
import fracIdxBetween from './fracIdxBetween';
import {
  FeatureChange,
  LayerChange,
  mergeFeature,
  mergeLayer,
} from '@/gen/sync_schema';

export class EditorStore {
  public readonly clientId: string;
  public mayEdit = false;

  private _unsent = new WorkingChangeset();
  private _layers: Map<string, LayerChange> = new Map();
  private _layerOrder: Map<string, LayerChange> = new Map();
  private _deletedFeatures: Set<string> = new Set();
  readonly ftree = new FNode(null, { id: '' });
  private _features: Map<string, FNode> = new Map([['', this.ftree]]);
  private _fidSeq = 0;
  private _onChange: () => any;

  /** `clientId` must be unique */
  constructor(props: {
    clientId: string;
    mayEdit: boolean;
    onChange: () => any;
  }) {
    this.clientId = props.clientId;
    this.mayEdit = props.mayEdit;
    this._onChange = props.onChange;
  }

  layerOrder(): LayerChange[] {
    return Array.from(this._layerOrder.entries())
      .sort(([a], [b]) => stringOrd(a, b))
      .map(([, layer]) => layer);
  }

  has(fid: string): boolean {
    return this._features.has(fid);
  }

  /** Make a local change */
  change(change: Changeset) {
    if (!this.mayEdit) throw new Error('may not edit');

    this._unsent.mergeIn(change);
    const fixes = this._mutate(change);
    if (fixes) this._unsent.mergeIn(fixes);
  }

  takeUnsent(): Changeset | undefined {
    if (this._unsent.isEmpty()) {
      return undefined;
    } else {
      const changeset = this._unsent.toChangeset();
      this._unsent.clear();
      return changeset;
    }
  }

  /** Receive a remote change.
   *
   * Returns fixes for values in change inconsistent with the store. */
  receive(change: Changeset): Changeset | undefined {
    return this._mutate(change);
  }

  createFeature(value: Omit<FeatureChange, 'id'>): string {
    if (!this.mayEdit) throw new Error('may not edit');
    if (
      value.parent === undefined ||
      value.parent === null ||
      value.idx === undefined ||
      value.idx === null
    ) {
      throw new Error('new feature must have parent and idx');
    }
    const id = this._allocateFid();
    this.change({ fadd: [id], fset: { [id]: { ...value, id } } });
    return id;
  }

  private _mutate(change: Changeset): Changeset | undefined {
    const fixes = new WorkingChangeset();

    this._deleteAll(new Set(change.fdelete), fixes);

    const added = new Set(change.fadd);
    for (const id of added) {
      const incoming = change.fset![id]!;
      this._finsert(true, incoming);
    }

    for (const [id, incoming] of Object.entries(change?.fset ?? {})) {
      if (added.has(id)) {
        continue;
      }
      this._finsert(false, incoming);
    }

    for (const incoming of Object.values(change?.lset ?? {})) {
      this._linsert(incoming);
    }

    if (!fixes.isEmpty()) {
      return fixes.toChangeset();
    }

    this._onChange();
  }

  private _deleteAll(incoming: Set<string>, fixes: WorkingChangeset) {
    for (const id of incoming) {
      const node = this._features.get(id);
      if (node) {
        // if we know the feature being deleted delete it and all its children
        this._deleteRecurse(node, incoming, fixes);
      } else {
        // otherwise just record this feature was deleted
        this._deletedFeatures.add(id);
      }
    }
  }

  private _deleteRecurse(
    node: FNode,
    incoming: Set<string>,
    fixes: WorkingChangeset,
  ) {
    // if incoming didn't know about a child, add it to fixes
    if (!incoming.has(node.id)) {
      fixes.fdelete.add(node.id);
    }
    // change our state
    const idx = node.value.idx;
    if (idx !== null && idx !== undefined) {
      node.parent!.children.delete(idx);
    }
    this._features.delete(node.id);
    this._deletedFeatures.add(node.id);
    // recurse into children
    for (const child of node.children.values()) {
      this._deleteRecurse(child, incoming, fixes);
    }
  }

  private _finsert(isAdd: boolean, incoming: FeatureChange) {
    if (incoming.id === '') {
      throw new Error('cannot change root feature');
    }
    if (incoming.parent === null || incoming.idx === null) {
      throw new Error('cannot change parent or idx to unset');
    }
    const id = incoming.id;
    let feature = this._features.get(id);
    let prevParent: string | undefined;
    let prevIdx: string | undefined;
    if (feature === undefined) {
      if (!isAdd) {
        throw new Error('cannot update non-existent feature');
      }
      if (incoming.parent === undefined || incoming.idx === undefined) {
        throw new Error('new feature must have parent and idx');
      }
      feature = new FNode(
        null, // parent filled in below
        incoming,
      );
      this._features.set(id, feature);
    } else {
      if (incoming.parent !== undefined) {
        if (!this._features.has(incoming.parent)) {
          throw new Error('cannot change parent: parent id not in store');
        }
      }
      isAdd = false;
      prevParent = feature.value.parent!;
      prevIdx = feature.value.idx!;
      mergeFeature(feature.value, incoming);
    }

    // update this.ftree
    if (
      isAdd ||
      feature.value.parent != prevParent ||
      feature.value.idx != prevIdx
    ) {
      if (!isAdd) {
        const prevParentNode = this._features.get(prevParent!);
        if (prevParentNode === undefined) {
          throw new Error('bug: parent node missing');
        }
        prevParentNode.children.delete(prevIdx!);
      }

      let parent = this._features.get(feature.value.parent!)!;
      if (parent === undefined) {
        throw new Error('bug: we check earlier in this func parent exists');
      }

      // fix cycle
      if (this._wouldCycle(feature, parent)) {
        // we fix our view temporarily, but don't sync it to the server
        feature.value.parent = '';
        feature.value.idx = this.ftree.idxBeforeFirstChild();
        parent = this.ftree;
      }

      // fix idx collision
      if (parent.children.has(feature.value.idx!)) {
        // we fix our view temporarily, but don't sync it to the server
        feature.value.idx = parent.idxBeforeFirstChild();
      }

      feature.parent = parent;
      parent.children.set(feature.value.idx!, feature);
    }
  }

  private _wouldCycle(feature: FNode, parent: FNode): boolean {
    for (let node = parent; node !== null; node = node.parent!) {
      if (node === feature) {
        return true;
      }
    }
    return false;
  }

  private _linsert(incoming: LayerChange) {
    const id = incoming.id;
    let layer = this._layers.get(id);
    let prevIdx: string | undefined;
    let hasPrevIdx = false;
    if (layer === undefined) {
      layer = incoming;
      this._layers.set(id, layer);
    } else {
      hasPrevIdx = layer.idx !== undefined && layer.idx !== null;
      prevIdx = layer.idx ?? undefined;
      mergeLayer(layer, incoming);
    }

    // update this._layerOrder
    const hasIdx = layer.idx !== undefined && layer.idx !== null;
    if (hasIdx != hasPrevIdx || layer.idx != prevIdx) {
      if (hasPrevIdx) {
        this._layerOrder.delete(prevIdx!);
      }
      if (hasIdx) {
        if (this._layerOrder.has(layer.idx!)) {
          layer.idx = this._idxBeforeFirstLayer();
        }
        this._layerOrder.set(layer.idx!, layer);
      }
    }
  }

  private _idxBeforeFirstLayer(): string {
    const peers = Array.from(this._layerOrder.keys());
    peers.sort();

    let after = '';
    if (peers.length > 0) {
      after = peers[0]!;
    }
    return fracIdxBetween('', after);
  }

  private _allocateFid(): string {
    return `F-${this.clientId}-${++this._fidSeq}`;
  }
}

export class FNode {
  readonly id: string;
  children = new Map<string, FNode>(); // by idx

  constructor(
    public parent: FNode | null,
    public value: FeatureChange,
  ) {
    this.id = value.id;
  }

  childOrder(): FNode[] {
    return Array.from(this.children.entries())
      .sort(([a], [b]) => stringOrd(a, b))
      .map(([, child]) => child);
  }

  idxBeforeFirstChild(): string {
    return fracIdxBetween('', this.childOrder()[0]?.value.idx ?? '');
  }
}

class WorkingChangeset {
  fdelete = new Set<string>();
  fadd = new OrderedSet<string>();
  fset = new Map<string, FeatureChange>();
  lset = new Map<string, LayerChange>();

  isEmpty(): boolean {
    return (
      this.fdelete.size === 0 &&
      this.fadd.size === 0 &&
      this.fset.size === 0 &&
      this.lset.size === 0
    );
  }

  mergeIn(other: Changeset) {
    if (other.fdelete) {
      for (const id of other.fdelete) {
        this.fdelete.add(id);
      }
    }
    if (other.fadd) {
      for (const id of other.fadd) {
        this.fadd.add(id);
      }
    }
    if (other.fset) {
      for (const [id, change] of Object.entries(other.fset)) {
        const prev = this.fset.get(id);
        if (prev) {
          mergeFeature(prev, change);
        } else {
          this.fset.set(id, change);
        }
      }
    }
    if (other.lset) {
      for (const [id, change] of Object.entries(other.lset)) {
        const prev = this.lset.get(id);
        if (prev) {
          mergeLayer(prev, change);
        } else {
          this.lset.set(id, change);
        }
      }
    }
  }

  toChangeset(): Changeset {
    const fdelete = [...this.fdelete];
    const fadd = [...this.fadd];
    const fset = Object.fromEntries(this.fset);
    const lset = Object.fromEntries(this.lset);
    return { fdelete, fadd, fset, lset };
  }

  clear() {
    this.fdelete.clear();
    this.fadd.clear();
    this.fset.clear();
    this.lset.clear();
  }
}

class OrderedSet<T> {
  private _set = new Set<T>();
  private _list: T[] = [];

  add(value: T) {
    if (this._set.has(value)) {
      return;
    }
    this._set.add(value);
    this._list.push(value);
  }

  get size(): number {
    return this._set.size;
  }

  [Symbol.iterator]() {
    return this._list[Symbol.iterator]();
  }

  clear() {
    this._set.clear();
    this._list.length = 0;
  }
}

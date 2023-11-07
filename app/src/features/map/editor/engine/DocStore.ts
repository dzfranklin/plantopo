import { FeatureChange, LayerChange } from '@/gen/sync_schema';
import { Changeset } from '../api/Changeset';
import stringOrd from '@/generic/stringOrd';
import { WorkingChangeset } from './WorkingChangeset';
import { reverseChange } from './reverseChange';

/*
For now I hide rare issues and wait for the server to fix

Cycles are ommitted by default as they can't include the root.

When indices collide I keep the one with the lexographically smaller id.
*/

export interface DocState {
  layerOrder: DocActiveLayer[];
  byLayer: Map<string, DocActiveLayer | DocInactiveLayer>;
  features: {
    value: FeatureChange;
    children: DocFeature[];
  };
  byFeature: Map<string, DocFeature>;
}

export interface DocActiveLayer {
  value: LayerChange & { idx: string };
}

export interface DocInactiveLayer {
  value: LayerChange & { idx: null | undefined };
}

export interface DocFeature {
  parent: DocFeature | null;
  children: DocFeature[];
  value: FeatureChange & { parent: string; idx: string };
}

export interface UndoStatus {
  canUndo: boolean;
  canRedo: boolean;
}

const MAX_UNDO_STACK = 1000;
const MERGE_WINDOW_IDLE_MS = 1000;

export class DocStore {
  private _fadds = new Map<string, number | null>();
  private _fdeletes = new Map<string, number | null>();
  /** _f is the map of feature entries */
  private _f = new Map<string, Entry>();
  /** _l is the map of layer entries */
  private _l = new Map<string, Entry>();

  private _undoStack: UndoEntry[] = [];
  private _undoCursor: number | null = null;

  constructor() {
    this._f.set('', new Entry(''));
  }

  localUpdate(generation: number, change: Changeset, ts = Date.now()) {
    this._localUpdate(generation, change, true, ts);
  }

  private _localUpdate(
    generation: number,
    change: Changeset,
    pushUndoEntry: boolean,
    ts = Date.now(),
  ) {
    let reverse: Changeset | null = null;
    if (pushUndoEntry) {
      reverse = reverseChange(this, change);
    }

    if (change.fdelete) {
      const preState = this.toState();
      this._fdeleteAll(
        generation,
        generation,
        preState,
        new Set(change.fdelete),
      );
    }

    const added = new Set(change.fadd);
    for (const id of added) {
      const incoming = change.fset![id]!;
      if (this._f.has(id)) {
        console.warn('local fadd for existing feature', id);
      }
      this._fadds.set(id, generation);
      const entry = this._getOrInsertF(id);
      entry.mergeLocal(generation, incoming as any as Record<string, unknown>);
    }

    if (change.fset) {
      for (const [id, incoming] of Object.entries(change.fset)) {
        if (added.has(id)) continue;
        const entry = this._f.get(id);
        if (!entry) {
          console.warn('local fset for unknown feature', id);
          continue;
        }
        entry.mergeLocal(
          generation,
          incoming as any as Record<string, unknown>,
        );
      }
    }

    if (change.lset) {
      for (const incoming of Object.values(change.lset)) {
        const entry = this._getOrInsertL(incoming.id);
        entry.mergeLocal(
          generation,
          incoming as any as Record<string, unknown>,
        );
      }
    }

    if (reverse !== null) {
      if (this._undoCursor !== null) {
        this._undoStack = this._undoStack.slice(0, this._undoCursor + 1);
        this._undoCursor = this._undoStack.length - 1;
      }
      if (this._undoStack.length >= MAX_UNDO_STACK) {
        this._undoStack.shift();
        this._undoCursor = this._undoStack.length - 1;
      }

      const prev = this._undoStack.at(-1);
      const entry = {
        fwd: change,
        rev: reverse,
        ts,
      };
      if (!prev || !maybeMergeIntoUndoEntry(prev, entry)) {
        this._undoStack.push(entry);
        this._undoCursor = this._undoStack.length - 1;
      }
      this._triggerUndoStatus();
    }
  }

  undo(generation: number) {
    if (!this._canUndo()) return;
    const entry = this._undoStack[this._undoCursor!]!;
    this._localUpdate(generation, entry.rev, false);
    this._undoCursor!--;
    this._triggerUndoStatus();
  }

  redo(generation: number) {
    if (!this._canRedo()) return;
    this._undoCursor!++;
    const entry = this._undoStack[this._undoCursor!]!;
    this._localUpdate(generation, entry.fwd, false);
    this._triggerUndoStatus();
  }

  undoStatus(): UndoStatus {
    return {
      canUndo: this._canUndo(),
      canRedo: this._canRedo(),
    };
  }

  private _undoStatusListeners = new Set<(_: UndoStatus) => any>();

  addUndoStatusListener(cb: (status: UndoStatus) => any): () => void {
    this._undoStatusListeners.add(cb);
    return () => this._undoStatusListeners.delete(cb);
  }

  private _prevUndoStatus: UndoStatus | null = null;

  private _triggerUndoStatus() {
    const value = this.undoStatus();
    if (
      this._prevUndoStatus === null ||
      value.canUndo !== this._prevUndoStatus.canUndo ||
      value.canRedo !== this._prevUndoStatus.canRedo
    ) {
      this._prevUndoStatus = value;
      for (const cb of this._undoStatusListeners) {
        cb(value);
      }
    }
  }

  private _canUndo(): boolean {
    return this._undoCursor !== null && this._undoCursor >= 0;
  }

  private _canRedo(): boolean {
    return (
      this._undoCursor !== null && this._undoCursor < this._undoStack.length - 1
    );
  }

  remoteUpdate(localFixGeneration: number, change: Changeset) {
    const preState = this.toState();

    if (change.fdelete) {
      this._fdeleteAll(
        null,
        localFixGeneration,
        preState,
        new Set(change.fdelete),
      );
    }

    const added = new Set(change.fadd);
    for (const id of added) {
      const incoming = change.fset![id]!;
      const entry = this._getOrInsertF(id);
      this._fadds.set(id, null);
      entry.mergeRemote(incoming as any as Record<string, unknown>);
    }

    if (change.fset) {
      for (const [id, incoming] of Object.entries(change.fset)) {
        if (added.has(id)) continue;
        const entry = this._f.get(id);
        if (!entry) {
          console.warn('remote fset for unknown feature', id);
          continue;
        }

        entry.mergeRemote(incoming as any as Record<string, unknown>);
      }
    }

    if (change.lset) {
      for (const incoming of Object.values(change.lset)) {
        const entry = this._getOrInsertL(incoming.id);
        entry.mergeRemote(incoming as any as Record<string, unknown>);
      }
    }
  }

  /** Update for an ack received from the remote */
  remoteAck(ack: number) {
    for (const [id, gen] of this._fdeletes) {
      if (gen !== null && gen <= ack) {
        this._fdeletes.set(id, null);
      }
    }
    for (const entry of this._f.values()) {
      entry.updateForAck(ack);
    }
    for (const entry of this._l.values()) {
      entry.updateForAck(ack);
    }
  }

  featureRecord(fid: string): Readonly<Record<string, unknown>> | undefined {
    return this._f.get(fid)?.toValue();
  }

  layerRecord(lid: string): Readonly<Record<string, unknown>> | undefined {
    return this._l.get(lid)?.toValue();
  }

  toChange(): Changeset | null {
    const out = new WorkingChangeset();
    for (const [fid] of this._fadds) {
      out.fadd.add(fid);
    }
    for (const [fid] of this._fdeletes) {
      out.fdelete.add(fid);
    }
    for (const entry of this._f.values()) {
      out.fset.set(entry.id, entry.toValue() as any as FeatureChange);
    }
    for (const entry of this._l.values()) {
      out.lset.set(entry.id, entry.toValue() as any as LayerChange);
    }
    return out.toChangeset();
  }

  toState(): DocState {
    const byLayer = new Map<string, DocActiveLayer | DocInactiveLayer>();
    let layerOrder: DocActiveLayer[] = [];
    const layerIndices = new Set<string>();
    const layerIdxCollisions = new Set<string>();
    for (const entry of this._l.values()) {
      const value = entry.toValue() as any as LayerChange;
      if (value.idx !== null && value.idx !== undefined) {
        const activeValue = value as any as LayerChange & { idx: string };
        const layer = { value: activeValue };
        if (layerIndices.has(activeValue.idx)) {
          layerIdxCollisions.add(activeValue.idx);
        } else {
          layerIndices.add(activeValue.idx);
        }
        layerOrder.push(layer);
        byLayer.set(activeValue.id, layer);
      } else {
        const inactiveValue = value as any as LayerChange & {
          idx: null | undefined;
        };
        const layer = { value: inactiveValue };
        byLayer.set(entry.id, layer);
      }
    }
    layerOrder.sort((a, b) => {
      if (a.value.idx < b.value.idx) return -1;
      if (a.value.idx > b.value.idx) return 1;
      return stringOrd(a.value.id, b.value.id);
    });
    if (layerIdxCollisions.size > 0) {
      const fixed: DocActiveLayer[] = [];
      const toSkip = new Set<string>();
      for (const layer of layerOrder) {
        const idx = layer.value.idx;
        if (toSkip.has(idx)) {
          continue;
        }
        if (layerIdxCollisions.has(idx)) {
          toSkip.add(idx);
        }
        fixed.push(layer);
      }
      layerOrder = fixed;
    }

    const fByParent = new Map<string, Set<Entry>>();
    for (const entry of this._f.values()) {
      const parent = entry.get('parent');
      if (typeof parent !== 'string') continue;

      let peers = fByParent.get(parent);
      if (!peers) {
        peers = new Set();
        fByParent.set(parent, peers);
      }

      peers.add(entry);
    }

    const byFeature = new Map<string, DocFeature>();
    const features = {
      value: this._f.get('')!.toValue() as any as FeatureChange,
      children: this._featureChildrenToState(null, fByParent, byFeature),
    };

    return {
      layerOrder,
      byLayer,
      features,
      byFeature,
    };
  }

  private _featureChildrenToState(
    parent: DocFeature | null,
    fByParent: Map<string, Set<Entry>>,
    outMap: Map<string, DocFeature>,
  ): DocFeature[] {
    const entrySet = fByParent.get(parent?.value.id ?? '');
    if (!entrySet) return [];

    const children: DocFeature[] = [];
    const indices = new Set<string>();
    const idxCollisions = new Set<string>();
    for (const entry of entrySet) {
      const maybeValue = entry.toValue() as any as FeatureChange;
      if (
        typeof maybeValue.idx !== 'string' ||
        typeof maybeValue.parent !== 'string'
      ) {
        continue;
      }
      const value = maybeValue as any as FeatureChange & {
        idx: string;
        parent: string;
      };

      if (indices.has(value.idx)) {
        idxCollisions.add(value.idx);
      } else {
        indices.add(value.idx);
      }

      const state: DocFeature = {
        parent,
        value,
        children: [],
      };
      state.children = this._featureChildrenToState(state, fByParent, outMap);
      children.push(state);
      outMap.set(value.id, state);
    }

    children.sort((a, b) => {
      if (a.value.idx < b.value.idx) return -1;
      if (a.value.idx > b.value.idx) return 1;
      return stringOrd(a.value.id, b.value.id);
    });

    if (idxCollisions.size > 0) {
      const fixed: DocFeature[] = [];
      const toSkip = new Set<string>();
      for (const child of children) {
        const idx = child.value.idx;
        if (toSkip.has(idx)) {
          continue;
        }
        if (idxCollisions.has(idx)) {
          toSkip.add(idx);
        }
        fixed.push(child);
      }
      return fixed;
    } else {
      return children;
    }
  }

  /** Changes since `generation` generation (exclusive) */
  localChangesAfter(generation: number): Changeset | null {
    const out = new WorkingChangeset();
    for (const [fid, delG] of this._fdeletes) {
      if (delG !== null && delG > generation) {
        out.fdelete.add(fid);
      }
    }
    for (const [fid, addG] of this._fadds) {
      if (addG !== null && addG > generation) {
        out.fadd.add(fid);
      }
    }
    for (const entry of this._f.values()) {
      entry.localChangesAfter(
        generation,
        out.fset as any as Map<string, Record<string, unknown>>,
      );
    }
    for (const entry of this._l.values()) {
      entry.localChangesAfter(
        generation,
        out.lset as any as Map<string, Record<string, unknown>>,
      );
    }
    return out.toChangeset();
  }

  private _fdeleteAll(
    generation: number | null,
    fixGeneration: number | null,
    preState: DocState,
    incoming: Set<string>,
  ) {
    const seen = new Set<string>();
    for (const id of incoming) {
      const entry = this._f.get(id);
      if (entry) {
        // if we know the feature being deleted delete it and all its children
        this._fdeleteRecurse(
          entry,
          incoming,
          generation,
          fixGeneration,
          seen,
          preState,
        );
      } else {
        // otherwise just record this feature was deleted
        this._fdeletes.set(id, generation);
        this._fadds.delete(id);
      }
    }
  }

  private _fdeleteRecurse(
    entry: Entry,
    incoming: Set<string>,
    generation: number | null,
    fixGeneration: number | null,
    seen: Set<string>,
    preState: DocState,
  ) {
    if (seen.has(entry.id)) {
      return;
    }
    seen.add(entry.id);

    if (incoming.has(entry.id)) {
      this._fdeletes.set(entry.id, generation);
    } else {
      this._fdeletes.set(entry.id, fixGeneration);
    }
    // change our state
    this._f.delete(entry.id);
    this._fadds.delete(entry.id);
    // recurse into children if not already deleted
    for (const childState of preState.byFeature.get(entry.id)!.children) {
      const child = this._f.get(childState.value.id);
      if (child) {
        this._fdeleteRecurse(
          child,
          incoming,
          generation,
          fixGeneration,
          seen,
          preState,
        );
      }
    }
  }

  private _getOrInsertF(id: string): Entry {
    let entry = this._f.get(id);
    if (!entry) {
      entry = new Entry(id);
      this._f.set(id, entry);
    }
    return entry;
  }

  private _getOrInsertL(id: string): Entry {
    let entry = this._l.get(id);
    if (!entry) {
      entry = new Entry(id);
      this._l.set(id, entry);
    }
    return entry;
  }
}

class Entry {
  local = new Map<string, unknown>();
  remote = new Map<string, unknown>();
  /** localGeneration maps keys in `local` to the generation of their value */
  localGeneration = new Map<string, number>();

  constructor(public readonly id: string) {}

  mergeLocal(generation: number, change: Record<string, unknown>) {
    for (const [key, value] of Object.entries(change)) {
      if (key === 'id') continue;
      if (value !== undefined) {
        this.local.set(key, value);
        this.localGeneration.set(key, generation);
      }
    }
  }

  mergeRemote(change: Record<string, unknown>) {
    for (const [key, value] of Object.entries(change)) {
      if (key === 'id') continue;
      if (value !== undefined) {
        this.remote.set(key, value);
      }
    }
  }

  updateForAck(ack: number) {
    for (const [k, gen] of this.localGeneration) {
      if (gen <= ack) {
        this.local.delete(k);
        this.localGeneration.delete(k);
      }
    }
  }

  toValue(): Record<string, unknown> {
    const out: Record<string, unknown> = { id: this.id };
    for (const [k, v] of this.remote) {
      out[k] = v;
    }
    for (const [k, v] of this.local) {
      if (v !== undefined) {
        out[k] = v;
      }
    }
    return out;
  }

  get(key: string): unknown {
    let v = this.local.get(key);
    if (v === undefined) v = this.remote.get(key);
    return v;
  }

  localChangesAfter(start: number, out: Map<string, Record<string, unknown>>) {
    for (const [k, gen] of this.localGeneration) {
      if (gen <= start) continue;

      let outEntry = out.get(this.id);
      if (!outEntry) {
        outEntry = { id: this.id };
        out.set(this.id, outEntry);
      }

      const v = this.local.get(k);
      outEntry[k] = v;
    }
  }
}

interface UndoEntry {
  fwd: Changeset;
  rev: Changeset;
  ts: number;
}

function maybeMergeIntoUndoEntry(target: UndoEntry, from: UndoEntry): boolean {
  // CHECK

  if (from.ts - target.ts > MERGE_WINDOW_IDLE_MS) return false;

  // if fadd/fdelete then ineligable
  if (from.fwd.fdelete && from.fwd.fdelete.length > 0) return false;
  if (target.fwd.fdelete && target.fwd.fdelete.length > 0) return false;
  if (from.fwd.fadd && from.fwd.fadd.length > 0) return false;
  if (target.fwd.fadd && target.fwd.fadd.length > 0) return false;

  // if fset then keys must be equal
  if (from.fwd.fset) {
    if (!target.fwd.fset) return false;
    const currKeys = new Set(Object.keys(from.fwd.fset));
    currKeys.delete('id');
    const prevKeys = new Set(Object.keys(target.fwd.fset));
    prevKeys.delete('id');
    if (currKeys.size !== prevKeys.size) return false;
    for (const k of currKeys) {
      if (!prevKeys.has(k)) return false;
    }
  }

  // if lset then keys must be equal
  if (from.fwd.lset) {
    if (!target.fwd.lset) return false;
    const currKeys = new Set(Object.keys(from.fwd.lset));
    currKeys.delete('id');
    const prevKeys = new Set(Object.keys(target.fwd.lset));
    prevKeys.delete('id');
    if (currKeys.size !== prevKeys.size) return false;
    for (const k of currKeys) {
      if (!prevKeys.has(k)) return false;
    }
  }

  // MERGE

  // We can keep rev the same because we want to reverse to the earliest values
  // and we enforce no new keys above

  if (from.fwd.fset) {
    for (const [k, v] of Object.entries(from.fwd.fset)) {
      if (k === 'id') continue;
      if (v !== undefined) {
        target.fwd.fset![k] = v;
      }
    }
  }

  if (from.fwd.lset) {
    for (const [k, v] of Object.entries(from.fwd.lset)) {
      if (k === 'id') continue;
      if (v !== undefined) {
        target.fwd.lset![k] = v;
      }
    }
  }

  return true;
}

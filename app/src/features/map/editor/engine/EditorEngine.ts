import { SyncTransport, SyncTransportStatus } from '../api/SyncTransport';
import { AwareCamera, AwareEntry, SetAwareRequest } from '../api/sessionMsg';
import { EditorStore, FNode } from './EditorStore';
import { v4 as uuidv4 } from 'uuid';
import {
  DEFAULT_SIDEBAR_WIDTH,
  EMPTY_SCENE,
  Scene,
  SceneFInsertPlace as SceneFeatureInsertPlace,
  SceneFeature,
  SceneLayer,
  InactiveSceneLayer,
  SceneRootFeature,
} from './Scene';
import { LayerSource, MapSources } from '../api/mapSources';
import { EditorPrefStore } from './EditorPrefStore';
import { FeatureChange, LayerChange } from '@/gen/sync_schema';
import fracIdxBetween from './fracIdxBetween';
import { Changeset } from '../api/Changeset';
import { deepEq } from '@/generic/equality';
import stringOrd from '@/generic/stringOrd';

const ROOT_FID = '';
const SEND_INTERVAL = 15; // ms

export type LayerInsertPlace =
  | { at: 'first' }
  | { at: 'last' }
  | { at: 'before'; target: string }
  | { at: 'after'; target: string };

export class EditorEngine {
  public readonly mapId: string;
  public readonly clientId: string;
  public readonly mayEdit: boolean;
  public readonly sources: MapSources;

  private _seq = 0;
  private _transport: SyncTransport;
  private _store: EditorStore;
  private _prefs: EditorPrefStore;
  private _sendInterval: number;
  private _getCamera: () => AwareCamera | undefined = () => undefined;

  private _awareMap: Readonly<Record<string, AwareEntry>> = {};

  private _scene: Scene | null = null;
  private _sceneNodes = new Map<string, SceneFeature>();
  private _sidebarWidth: number | undefined;
  private _hoveredByMe: string | null = null; // fid
  private _selectedByMe = new Set<string>(); // fid
  private _layerSelectedByMe: string | null = null; // lid

  private _sceneSelectorId = 0;
  private _sceneSelectors = new Map<number, SceneSelectorEntry>();

  constructor({
    mapId,
    mayEdit,
    mapSources,
    prefs,
  }: {
    mapId: string;
    mayEdit: boolean;
    mapSources: MapSources;
    prefs?: EditorPrefStore;
  }) {
    // Note that the clientId cannot be reused for another `EditorStore`
    const clientId = uuidv4();

    this.clientId = clientId;
    this.mapId = mapId;
    this.mayEdit = mayEdit;
    this.sources = mapSources;
    this._store = new EditorStore({
      clientId,
      mayEdit,
      onChange: () => this._renderScene(),
    });
    this._prefs = prefs ?? new EditorPrefStore();
    this._transport = new SyncTransport({ mapId, clientId });
    this._transport.onMessage = (msg) => {
      if (msg.aware) {
        this._awareMap = msg.aware;
      }
      if (msg.change) {
        this._store.receive(msg.change);
      }
    };
    this._sidebarWidth = this._prefs.sidebarWidth();
    this._sendInterval = window.setInterval(() => {
      const change = this.mayEdit ? this._store.takeUnsent() : undefined;
      this._transport.send({
        seq: this._seq++,
        aware: this._makeSetAwareRequest(),
        change,
      });
    }, SEND_INTERVAL);
  }

  destroy(): void {
    this._transport.destroy();
    window.clearInterval(this._sendInterval);
  }

  private _makeSetAwareRequest(): SetAwareRequest {
    return {
      camera: this._getCamera(),
      selectedFeatures: [...this._selectedByMe],
    };
  }

  get transportStatus(): SyncTransportStatus {
    return this._transport.status;
  }

  set onTransportStatus(cb: (status: SyncTransportStatus) => any) {
    this._transport.onStatus = cb;
  }

  setCameraGetter(getCamera: () => AwareCamera | undefined): void {
    this._getCamera = getCamera;
  }

  get scene(): Readonly<Scene> {
    return this._scene ?? EMPTY_SCENE;
  }

  addSceneSelector<T>(
    sel: (_: Scene, query: (fid: string) => SceneFeature | undefined) => T,
    cb: (_: T) => any,
    equalityFn?: (a: T, b: T) => boolean,
  ): () => void {
    const id = this._sceneSelectorId++;
    const entry: SceneSelectorEntry = {
      sel,
      cb,
    };
    if (equalityFn) entry.equalityFn = equalityFn;
    this._sceneSelectors.set(id, entry);
    return () => this._sceneSelectors.delete(id);
  }

  setSidebarWidth(width: number): void {
    this._sidebarWidth = width;
    this._prefs.setSidebarWidth(width);
    this._renderScene();
  }

  getFeature(fid: string): SceneFeature | undefined {
    return this._sceneNodes.get(fid);
  }

  createFeature(value: Omit<FeatureChange, 'id'> = {}): string {
    const resolved = this._resolveFeaturePlace(this.scene.features.insertPlace);
    const idx = fracIdxBetween(resolved.before, resolved.after);
    const fid = this._store.createFeature({
      ...value,
      parent: resolved.parent,
      idx,
    });
    return fid;
  }

  changeFeature(change: FeatureChange) {
    if (change.id === undefined || change.id === null) {
      throw new Error('Cannot update feature without id');
    }
    if (change.id === ROOT_FID) {
      throw new Error('Cannot update root feature');
    }
    this._store.change({ fset: { [change.id]: change } });
  }

  private _resolveFeaturePlace(place: SceneFeatureInsertPlace): {
    parent: string; // fid
    before: string; // FracIdx
    after: string; // FracIdx
  } {
    let parent: string;
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

  isSelectedByMe(fid: string): boolean {
    return this._selectedByMe.has(fid);
  }

  hasAncestorSelectedByMe(fid: string): boolean {
    const parent = this._sceneNodes.get(fid)?.parent.id;
    if (parent === undefined || parent === ROOT_FID) return false;
    if (this.isSelectedByMe(parent)) return true;
    return this.hasAncestorSelectedByMe(parent);
  }

  setHovered(fid: string | null): void {
    this._hoveredByMe = fid;
    this._renderScene();
  }

  toggleSelection(fid: string, mode: 'single' | 'multi'): void {
    const wasSelected = this._selectedByMe.has(fid);
    if (mode === 'single') {
      this._selectedByMe.clear();
      if (!wasSelected) {
        this._selectedByMe.add(fid);
      }
    } else {
      if (wasSelected) {
        this._selectedByMe.delete(fid);
      } else {
        this._selectedByMe.add(fid);
      }
    }
    this._renderScene();
  }

  clearSelection(): void {
    this._selectedByMe.clear();
    this._renderScene();
  }

  moveSelected(place: SceneFeatureInsertPlace): void {
    const features = this._computeSelectionForMove();
    const resolved = this._resolveFeaturePlace(place);
    const parent = resolved.parent;
    let before = resolved.before;
    const after = resolved.after;
    const fset: NonNullable<Changeset['fset']> = {};
    for (const fid of features) {
      const idx = fracIdxBetween(before, after);
      fset[fid] = { id: fid, parent, idx };
      before = idx;
    }
    this._store.change({ fset });
  }

  private _computeSelectionForMove(
    start = ROOT_FID,
    out: string[] = [],
  ): string[] {
    const node = this.getFeature(start);
    if (!node) return out;
    for (const child of node.children) {
      if (child.selectedByMe) {
        out.push(child.id);
      } else {
        this._computeSelectionForMove(child.id, out);
      }
    }
    return out;
  }

  changeLayer(change: LayerChange) {
    if (change.id === undefined || change.id === null) {
      throw new Error('Cannot update layer without id');
    }
    this._store.change({ lset: { [change.id]: change } });
  }

  setSelectedLayer(lid: string | null) {
    this._layerSelectedByMe = lid;
    this._renderScene();
  }

  moveSelectedLayer(place: LayerInsertPlace): void {
    const lid = this._layerSelectedByMe;
    if (lid === null) return;
    const resolved = this._resolveLayerPlace(place);
    const idx = fracIdxBetween(resolved.before, resolved.after);
    this._store.change({ lset: { [lid]: { id: lid, idx } } });
  }

  private _resolveLayerPlace(place: LayerInsertPlace): {
    before: string; // idx
    after: string; // idx
  } {
    let before = '';
    let after = '';
    const order = this._store.layerOrder();
    if (place.at === 'first') {
      after = order[0]?.idx || '';
    } else if (place.at === 'last') {
      before = order.at(-1)?.idx || '';
    } else {
      const targetI = order.findIndex((p) => p.id === place.target);
      if (targetI < 0) {
        return this._resolveLayerPlace({ at: 'first' });
      }

      if (place.at === 'before') {
        if (targetI > 0) {
          before = order[targetI - 1]!.idx!;
        }
        after = order[targetI]!.idx!;
      } else if (place.at === 'after') {
        if (targetI < order.length - 1) {
          after = order[targetI + 1]!.idx!;
        }
        before = order[targetI]!.idx!;
      } else {
        throw new Error('Unreachable');
      }
    }
    return { before, after };
  }

  private _renderScene(): Scene {
    const start = performance.now();
    const layers = this._renderLayers();
    const features = this._renderFeatures();
    const end = performance.now();
    this._scene = {
      timing: { start, end },
      sidebarWidth: this._sidebarWidth ?? DEFAULT_SIDEBAR_WIDTH,
      layers,
      features,
    };

    const query = (fid: string) => this.getFeature(fid);
    for (const entry of this._sceneSelectors.values()) {
      const value = entry.sel(this._scene, query);
      if (value === entry.cached) continue;
      if (entry.equalityFn) {
        if (entry.equalityFn(value, entry.cached)) {
          continue;
        }
      }
      entry.cached = value;
      entry.cb(value);
    }

    return this._scene;
  }

  private _renderLayers(): Scene['layers'] {
    const active: SceneLayer[] = [];
    const activeSet = new Set<LayerSource>();
    for (const layer of this._store.layerOrder()) {
      const idx = layer.idx!;
      const source = this.sources.layers[layer.id];
      if (!source) continue;
      active.push({
        id: layer.id,
        idx,
        source,
        opacity: layer.opacity ?? null,
        selectedByMe: layer.id === this._layerSelectedByMe,
      });
      activeSet.add(source);
    }

    if (this._scene && deepEq(this._scene.layers.active, active)) {
      // Inactive can't have changed if active didn't because source is static
      return this._scene.layers;
    }

    const inactive: InactiveSceneLayer[] = [];
    for (const source of Object.values(this.sources.layers)) {
      if (activeSet.has(source)) continue;
      inactive.push({
        id: source.id,
        source,
        selectedByMe: source.id === this._layerSelectedByMe,
      });
    }
    inactive.sort((a, b) => stringOrd(a.source.name, b.source.name));

    return { active, inactive };
  }

  private _renderFeatures(): Scene['features'] {
    this._sceneNodes.clear();

    const root: SceneRootFeature = {
      id: ROOT_FID,
      parent: null,
      children: [],
    };

    const peerSelection = new Map<string, string[]>(); // fid -> peerId
    for (const [peerId, entry] of Object.entries(this._awareMap)) {
      if (peerId === this.clientId) continue;
      if (entry.selectedFeatures) {
        for (const fid of entry.selectedFeatures) {
          const prev = peerSelection.get(fid);
          if (prev) {
            prev.push(peerId);
          } else {
            peerSelection.set(fid, [peerId]);
          }
        }
      }
    }

    const ctx: RenderCtx = {
      insertPlace: {
        at: 'firstChild',
        target: root,
      },
      selectedByMe: [],
      peerSelection,
    };

    for (const child of this._store.ftree.childOrder()) {
      const feature = this._renderFeature(ctx, root, child);
      root.children.push(feature);
    }

    return {
      root,
      insertPlace: ctx.insertPlace,
      selectedByMe: ctx.selectedByMe,
    };
  }

  private _renderFeature(
    ctx: RenderCtx,
    parent: SceneFeature | SceneRootFeature,
    node: FNode,
  ): SceneFeature {
    const { value } = node;
    const selectedByMe = this._selectedByMe.has(node.id);
    const feature: SceneFeature = {
      id: node.id,
      parent,
      idx: value.idx!,
      children: [],
      hidden: value.hidden ?? false,
      geometry: value.geometry ?? null,
      name: value.name ?? null,
      color: value.color ?? null,
      selectedByMe,
      selectedByPeers: ctx.peerSelection.get(node.id) ?? null,
      hoveredByMe: this._hoveredByMe === node.id,
    };
    this._sceneNodes.set(node.id, feature);

    const children = node.childOrder();

    if (selectedByMe) {
      ctx.selectedByMe.push(feature);
      // The insertPlace should be the selected feature visually closest to the
      // bottom. If anyone is below us they'll overwrite as we're doing a depth
      // first search
      ctx.insertPlace = {
        at: children.length > 0 ? 'firstChild' : 'after',
        target: feature,
      };
    }

    for (const node of children) {
      const child = this._renderFeature(ctx, feature, node);
      feature.children.push(child);
    }

    return feature;
  }
}

interface SceneSelectorEntry {
  cached?: any;
  sel: (_: Scene, query: (fid: string) => SceneFeature | undefined) => unknown;
  cb: (_: any) => any;
  equalityFn?: (a: any, b: any) => boolean;
}

interface RenderCtx {
  insertPlace: SceneFeatureInsertPlace;
  selectedByMe: SceneFeature[];
  /** fid -> peerId */
  peerSelection: Map<string, string[]>;
}

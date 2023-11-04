import { SyncTransport, SyncTransportStatus } from '../api/SyncTransport';
import { AwareCamera, AwareEntry, SetAwareRequest } from '../api/sessionMsg';
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
import { CurrentCameraPosition } from '../CurrentCamera';
import { StateManager } from './StateManager';
import { DocFeature, DocState, UndoStatus } from './DocStore';
import { ulid } from 'ulid';
import { DEFAULT_KEYMAP, KeymapSpec, KeyBinding, Keymap } from './Keymap';
import { isMac as platformIsMac } from '@/features/platformIsMac';

const ROOT_FID = '';
const SEND_INTERVAL = 15; // ms

export type LayerInsertPlace =
  | { at: 'first' }
  | { at: 'last' }
  | { at: 'before'; target: string }
  | { at: 'after'; target: string };

type CameraListener = (
  _: Readonly<{
    center: [number, number];
    zoom: number;
    bearing: number;
    pitch: number;
  }>,
) => any;

export interface InitialCamera {
  center: [number, number];
  zoom: number;
  bearing: number;
  pitch: number;
}

export type EngineCommand =
  | 'undo'
  | 'redo'
  | 'select-line-tool'
  | 'select-point-tool'
  | 'delete-selected-feature'
  | 'finish-action';

export class EditorEngine {
  public readonly mapId: string;
  public readonly clientId: string;
  public readonly mayEdit: boolean;
  public readonly sources: MapSources;
  public readonly createdAt = Date.now();

  private _keymap: Keymap;
  private _keymapPlatform: 'mac' | 'pc';

  private _stateManager: StateManager;
  private _doc: DocState;
  private _transport: SyncTransport;
  private _prefs: EditorPrefStore;
  private _awareSendInterval: number;

  private _cam: CurrentCameraPosition | undefined;
  private _initialCam: InitialCamera | undefined;
  private _camMoveEndListeners = new Set<CameraListener>();

  private _awareMap: Readonly<Record<string, AwareEntry>> = {};

  private _scene: Scene | null = null;
  private _sceneNodes = new Map<string, SceneFeature>();
  private _sidebarWidth: number | undefined;
  private _hoveredByMe: string | null = null; // fid
  private _selectedByMe = new Set<string>(); // fid
  private _active: string | null = null; // fid
  private _layerSelectedByMe: string | null = null; // lid
  private _activeTool: Scene['activeTool'] = EMPTY_SCENE['activeTool'];

  private _sceneSelectorId = 0;
  private _sceneSelectors = new Map<number, SceneSelectorEntry>();

  private _transportStatusListeners = new Set<
    (_: SyncTransportStatus) => any
  >();

  constructor({
    mapId,
    mayEdit,
    mapSources,
    prefs,
    initialCamera,
    platform,
  }: {
    mapId: string;
    mayEdit: boolean;
    mapSources: MapSources;
    prefs?: EditorPrefStore;
    initialCamera?: Readonly<InitialCamera>;
    platform?: 'mac' | 'pc';
  }) {
    const clientId = ulid();

    this.clientId = clientId;
    this.mapId = mapId;
    this.mayEdit = mayEdit;
    this.sources = mapSources;

    this._initialCam = initialCamera;

    this._keymapPlatform = platform ?? (platformIsMac() ? 'mac' : 'pc');
    this._keymap = new Keymap(this._keymapPlatform, DEFAULT_KEYMAP);

    this._transport = new SyncTransport({ mapId, clientId });
    this._transport.addOnMessageListener((msg) => {
      if (msg.aware) {
        this._awareMap = msg.aware;
      }
    });
    this._transport.addOnStatusListener((status) => {
      for (const cb of this._transportStatusListeners) {
        cb(status);
      }
    });

    this._stateManager = new StateManager({
      clientId,
      transport: this._transport,
      onChange: (doc) => {
        this._doc = doc;
        this._renderScene();
      },
    });
    this._doc = this._stateManager.toState();

    this._prefs = prefs ?? new EditorPrefStore();

    this._sidebarWidth = this._prefs.sidebarWidth();

    this._awareSendInterval = window.setInterval(() => {
      this._transport.send({
        aware: this._makeSetAwareRequest(),
      });
    }, SEND_INTERVAL);
  }

  destroy(): void {
    this._transport.destroy();
    window.clearInterval(this._awareSendInterval);
  }

  private _makeSetAwareRequest(): SetAwareRequest {
    let camera: AwareCamera | undefined;
    if (this._cam) {
      camera = {
        lng: this._cam.center[0],
        lat: this._cam.center[1],
        zoom: this._cam.zoom,
        bearing: this._cam.bearing,
        pitch: this._cam.pitch,
      };
    }
    return {
      camera,
      selectedFeatures: [...this._selectedByMe],
    };
  }

  get initialCamera(): Readonly<InitialCamera | undefined> {
    return this._initialCam;
  }

  private _initialCamUpdateListeners = new Set<
    (_: InitialCamera | undefined) => any
  >();

  updateInitialCamera(cam: Readonly<InitialCamera | undefined>): void {
    this._initialCam = cam;
    for (const cb of this._initialCamUpdateListeners) {
      cb(cam);
    }
  }

  addInitialCameraUpdateListener(
    cb: (_: InitialCamera | undefined) => any,
  ): () => void {
    this._initialCamUpdateListeners.add(cb);
    return () => this._initialCamUpdateListeners.delete(cb);
  }

  addTransportStatusListener(cb: (_: SyncTransportStatus) => any): () => void {
    this._transportStatusListeners.add(cb);
    return () => this._transportStatusListeners.delete(cb);
  }

  addCameraMoveEndListener(cb: CameraListener): () => void {
    this._camMoveEndListeners.add(cb);
    return () => this._camMoveEndListeners.delete(cb);
  }

  notifyCameraUpdated(cam: CurrentCameraPosition): void {
    this._cam = cam;
  }

  notifyCameraMoveEnd(): void {
    if (this._cam) {
      for (const cb of this._camMoveEndListeners) {
        cb(this._cam);
      }
    }
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

  hasUnsyncedChanges(): boolean {
    return this._stateManager.hasUnsynced();
  }

  addHasUnsyncedListener(cb: (hasPending: boolean) => any): () => void {
    return this._stateManager.addHasUnsyncedListener(cb);
  }

  setSidebarWidth(width: number): void {
    this._sidebarWidth = width;
    this._prefs.setSidebarWidth(width);
    this._renderScene();
  }

  forceDisconnect(): void {
    this._transport.forceDisconnect();
  }

  _setActiveTool(tool: Scene['activeTool']): void {
    this._activeTool = tool;
    this._renderScene();
  }

  getFeature(fid: string): SceneFeature | undefined {
    return this._sceneNodes.get(fid);
  }

  createFeature(value: Omit<FeatureChange, 'id'> = {}): string {
    const resolved = this._resolveFeaturePlace(this.scene.features.insertPlace);
    const idx = fracIdxBetween(resolved.before, resolved.after);
    const fid = this._stateManager.createFeature({
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
    this._stateManager.update({ fset: { [change.id]: change } });
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

  setActiveFeature(fid: string | null): void {
    this._active = fid;
    this._selectedByMe.clear();
    if (fid) {
      this._selectedByMe.add(fid);
    }
    this._renderScene();
  }

  toggleSelection(fid: string, mode: 'single' | 'multi'): void {
    this._active = null;
    if (mode === 'single') {
      if (this._selectedByMe.size > 1) {
        this._selectedByMe.clear();
        this._selectedByMe.add(fid);
      } else {
        if (this._selectedByMe.has(fid)) {
          this._selectedByMe.delete(fid);
        } else {
          this._selectedByMe.clear();
          this._selectedByMe.add(fid);
          this._active = fid;
        }
      }
    } else {
      if (this._selectedByMe.has(fid)) {
        this._selectedByMe.delete(fid);
      } else {
        this._selectedByMe.add(fid);
      }
    }
    this._renderScene();
  }

  _finishAction(): void {
    this._active = null;
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
    this._stateManager.update({ fset });
  }

  private _computeSelectionForMove(
    start = ROOT_FID,
    out: string[] = [],
  ): string[] {
    let node: SceneFeature | SceneRootFeature | undefined;
    if (start === ROOT_FID) {
      node = this._scene?.features.root;
    } else {
      node = this.getFeature(start);
    }
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

  _deleteSelectedFeature(): void {
    let next: string | undefined = undefined;
    if (this._selectedByMe.size === 1) {
      const fid = [...this._selectedByMe][0]!;
      const parent = this._doc.byFeature.get(fid)?.parent;
      if (parent) {
        const peers = parent.children;
        const i = peers.findIndex((p) => p.value.id === fid);
        next =
          peers[i + 1]?.value.id ?? peers[i - 1]?.value.id ?? parent.value.id;
      }
    }
    this._stateManager.update({ fdelete: [...this._selectedByMe] });
    this._removeDeletedFromSelection();
    if (next) this.toggleSelection(next, 'single');
  }

  delete(fid: string): void {
    this._stateManager.update({ fdelete: [fid] });
    this._removeDeletedFromSelection();
  }

  private _removeDeletedFromSelection(): void {
    if (this._active && !this._doc.byFeature.has(this._active)) {
      this._active = null;
    }
    for (const fid of this._selectedByMe) {
      if (!this._doc.byFeature.has(fid)) {
        this._selectedByMe.delete(fid);
      }
    }
  }

  changeLayer(change: LayerChange) {
    if (change.id === undefined || change.id === null) {
      throw new Error('Cannot update layer without id');
    }
    this._stateManager.update({ lset: { [change.id]: change } });
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
    this._stateManager.update({ lset: { [lid]: { id: lid, idx } } });
  }

  private _resolveLayerPlace(place: LayerInsertPlace): {
    before: string; // idx
    after: string; // idx
  } {
    let before = '';
    let after = '';
    const order = this._doc.layerOrder;
    if (place.at === 'first') {
      after = order[0]?.value.idx || '';
    } else if (place.at === 'last') {
      before = order.at(-1)?.value.idx || '';
    } else {
      const targetI = order.findIndex((p) => p.value.id === place.target);
      if (targetI < 0) {
        return this._resolveLayerPlace({ at: 'first' });
      }

      if (place.at === 'before') {
        if (targetI > 0) {
          before = order[targetI - 1]!.value.idx!;
        }
        after = order[targetI]!.value.idx!;
      } else if (place.at === 'after') {
        if (targetI < order.length - 1) {
          after = order[targetI + 1]!.value.idx!;
        }
        before = order[targetI]!.value.idx!;
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
      activeTool: this._activeTool,
      layers,
      activeFeature: this._active
        ? this._sceneNodes.get(this._active) ?? null
        : null,
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
    for (const { value } of this._doc.layerOrder) {
      const idx = value.idx!;
      const source = this.sources.layers[value.id];
      if (!source) continue;
      active.push({
        id: value.id,
        idx,
        source,
        opacity: value.opacity ?? null,
        selectedByMe: value.id === this._layerSelectedByMe,
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

    for (const child of this._doc.features.children) {
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
    f: DocFeature,
  ): SceneFeature {
    const { value } = f;
    const selectedByMe = this._selectedByMe.has(value.id);
    const feature: SceneFeature = {
      id: value.id,
      parent,
      idx: value.idx!,
      children: [],
      hidden: value.hidden ?? false,
      geometry: value.geometry ?? null,
      name: value.name ?? null,
      color: value.color ?? null,
      active: value.id === this._active,
      selectedByMe,
      selectedByPeers: ctx.peerSelection.get(value.id) ?? null,
      hoveredByMe: this._hoveredByMe === value.id,
    };
    this._sceneNodes.set(value.id, feature);

    if (selectedByMe) {
      ctx.selectedByMe.push(feature);
      // The insertPlace should be the selected feature visually closest to the
      // bottom. If anyone is below us they'll overwrite as we're doing a depth
      // first search
      ctx.insertPlace = {
        at: f.children.length > 0 ? 'firstChild' : 'after',
        target: feature,
      };
    }

    for (const childF of f.children) {
      const child = this._renderFeature(ctx, feature, childF);
      feature.children.push(child);
    }

    return feature;
  }

  private _keymapListeners = new Set<(_: Keymap) => any>();

  addKeymapListener(cb: (_: Keymap) => any): () => void {
    this._keymapListeners.add(cb);
    return () => this._keymapListeners.delete(cb);
  }

  setKeymap(keymap: KeymapSpec): void {
    this._keymap = new Keymap(this._keymapPlatform, keymap);
    for (const cb of this._keymapListeners) {
      cb(this._keymap);
    }
  }

  keymap(): Keymap {
    return this._keymap;
  }

  executeKeyBinding(key: KeyBinding): boolean {
    const entry = this._keymap.lookup(key);
    if (entry) {
      this.execute(entry.cmd);
      return true;
    }
    return false;
  }

  execute(cmd: EngineCommand): void {
    switch (cmd) {
      case 'undo':
        this._stateManager.undo();
        break;
      case 'redo':
        this._stateManager.redo();
        break;
      case 'select-line-tool':
        this._setActiveTool('line');
        break;
      case 'select-point-tool':
        this._setActiveTool('point');
        break;
      case 'delete-selected-feature':
        this._deleteSelectedFeature();
        break;
      case 'finish-action':
        this._finishAction();
        break;
      default:
        throw new Error(`Unknown command: ${cmd}}`);
    }
  }

  undoStatus(): UndoStatus {
    return this._stateManager.undoStatus();
  }

  addUndoStatusListener(cb: (status: UndoStatus) => any): () => void {
    return this._stateManager.addUndoStatusListener(cb);
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

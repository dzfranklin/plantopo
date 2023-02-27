import {
  createAction,
  createSelector,
  createSlice,
  isAnyOf,
  PayloadAction,
} from '@reduxjs/toolkit';
import * as ml from 'maplibre-gl';
import type { RootState } from './store';
import { startListening } from './listener';
import { flash } from './flashSlice';
import { JsonObject, JsonTemplateObject } from '@sanalabs/json';
import {
  computeAtAfter,
  computeFeaturesDisplayList,
  Feature,
  Features,
  GroupFeature,
  parentIdOf,
  PointFeature,
  RouteFeature,
  serializeLngLat,
} from './feature/features';
import { WritableDraft } from 'immer/dist/internal';
import { v4 as uuid } from 'uuid';

interface MapState {
  enableLocalSave: boolean;
  onlineStatus: 'connecting' | 'connected' | 'reconnecting';
  tokens: Tokens;
  layerDatas: LayerDatas;
  layerSources: LayerSources;
  id: string;
  localAware: Aware;
  peerAwares?: { [clientId: number]: PeerAware };
  data?: {
    layers: Layer[];
    is3d: boolean;
    features: Features;
    featureTrash: Features;
  };
  geolocation: Geolocation;
  creating?: {
    type: string;
    at: string;
  };
}

export type LayerDatas = {
  [id: string]: LayerData;
};

export type LayerSources = {
  [id: string]: LayerSource;
};

export type PeerAware = Aware & { clientId: number; isCurrentClient: boolean };

export type ActiveFeature =
  | GroupFeature
  | PointFeature
  | RouteFeature
  | undefined;

export interface Aware {
  user?: { username: string; id: string };
  viewAt?: ViewAt;
  activeFeature?: string;
}

export interface Tokens {
  mapbox: string;
  os: string;
}

type LngLat = [number, number];
type XY = [number, number];

export interface ViewAt {
  center: LngLat;
  zoom: number;
  pitch: number;
  bearing: number;
}

export interface LayerData {
  id: number;
  attribution?: string;
  spec: ml.SourceSpecification;
}

export interface LayerSource {
  id: string;
  name: string;
  defaultOpacity: number | null;
  dependencies: string[];
  icon: string | null;
  glyphs: string | null;
  sprite: string | null;
  layerSpecs: ml.LayerSpecification[];
}

export interface Layer {
  sourceId: string;
  opacity?: number;
}

interface MapPointerEvent {
  lngLat: LngLat;
  screen: XY;
  features: {
    layer: string;
    properties: { [_: string]: unknown };
  }[];
}

interface Geolocation {
  updating: boolean;
  value?: {
    accuracy: number;
    position: LngLat;
  };
}

export type WsStatus = 'disconnected' | 'connecting' | 'connected';

const mapSlice = createSlice({
  name: 'map',
  initialState: null as unknown as MapState,
  reducers: {
    wsReportStatus(state, { payload }: PayloadAction<WsStatus>) {
      if (
        state.onlineStatus === 'connecting' ||
        state.onlineStatus === 'reconnecting'
      ) {
        if (payload === 'connected') {
          state.onlineStatus = 'connected';
        }
      } else if (state.onlineStatus === 'connected') {
        if (payload === 'disconnected' || payload === 'connecting') {
          state.onlineStatus = 'reconnecting';
        }
      }
    },

    // The map instance is the source of truth
    reportViewAt(state, { payload }: PayloadAction<ViewAt>) {
      state.localAware.viewAt = payload;
    },

    remoteUpdate(state, { payload }: PayloadAction<JsonTemplateObject>) {
      const value = (payload as unknown as Partial<MapState['data']>)!;
      state.data = {
        ...value, // Preserve unknown props
        layers: value.layers || [],
        is3d: value.is3d || false,
        features: value.features || {},
        featureTrash: value.featureTrash || {},
      };
    },
    remoteAwareUpdate(state, { payload }: PayloadAction<JsonObject[]>) {
      const list = payload as unknown as PeerAware[];
      state.peerAwares = {};
      for (const peer of list) {
        if (!peer.isCurrentClient) {
          state.peerAwares[peer.clientId] = peer;
        }
      }
    },

    updateLayer(
      state,
      { payload }: PayloadAction<{ idx: number; value: Partial<Layer> }>,
    ) {
      const layer = ensureData(state).layers[payload.idx];
      for (const prop in payload.value) {
        layer[prop] = payload.value[prop];
      }
    },
    removeLayer(state, { payload }: PayloadAction<number>) {
      if (!state.data) return;
      state.data.layers.splice(payload, 1);
    },
    addLayer(
      state,
      { payload: { sourceId } }: PayloadAction<{ sourceId: string }>,
    ) {
      const source = state.layerSources[sourceId];
      ensureData(state).layers.push({
        sourceId: sourceId,
        opacity: source.defaultOpacity || 1.0,
      });
    },
    setLayers(state, { payload }: PayloadAction<Layer[]>) {
      ensureData(state).layers = payload;
    },

    setIs3d(state, { payload }: PayloadAction<boolean>) {
      ensureData(state).is3d = payload;
    },

    setGeolocation(state, { payload }: PayloadAction<Geolocation>) {
      state.geolocation = payload;
    },
    clearGeolocation(state, _action: PayloadAction<undefined>) {
      state.geolocation = { updating: false };
    },

    setActive(state, { payload }: PayloadAction<Feature | undefined>) {
      state.localAware.activeFeature = payload ? payload.id : undefined;
    },

    startCreating(state, { payload }: PayloadAction<{ type: string }>) {
      const features = ensureData(state).features;
      const beforeId = state.localAware.activeFeature;
      const at = computeAtAfter(features, beforeId);
      state.creating = {
        type: payload.type,
        at,
      };
    },
    finishCreating(state, { payload }: PayloadAction<Feature>) {
      const features = ensureData(state).features;
      features[payload.id] = payload;
      state.localAware.activeFeature = payload.id;
      state.creating = undefined;
    },

    updateFeature(
      state,
      { payload }: PayloadAction<{ id: string; update: Partial<Feature> }>,
    ) {
      const feature = ensureData(state).features[payload.id];
      if (!feature) throw new Error('updateFeature: not found');
      for (const prop in payload.update) {
        feature[prop] = payload.update[prop];
      }
    },
    deleteFeature(state, { payload }: PayloadAction<Feature>) {
      const data = ensureData(state);

      const { id } = payload;
      const parentId = parentIdOf(payload);
      const list = computeFeaturesDisplayList(parentId, data.features);

      data.featureTrash[id] = payload;
      delete data.features[id];

      const deletedDisplayIdx = list.findIndex((f) => f.id === id);
      if (deletedDisplayIdx > -1) {
        const nextActive =
          list.at(deletedDisplayIdx + 1) || list.at(deletedDisplayIdx - 1);
        state.localAware.activeFeature = nextActive?.id;
      }
    },
  },
});

const ensureData = (state: WritableDraft<MapState> | MapState) => {
  if (!state.data) {
    throw new Error('Data not yet available');
  } else {
    return state.data;
  }
};

export default mapSlice.reducer;

// Actions

const actions = mapSlice.actions;
export const {
  wsReportStatus,
  reportViewAt,
  remoteUpdate,
  remoteAwareUpdate,
  clearGeolocation,
  updateLayer,
  removeLayer,
  addLayer,
  setLayers,
  setIs3d,
  setActive,
  startCreating,
  updateFeature,
  deleteFeature,
} = actions;

// Intercepted by map
interface FlyToOptions {
  ignoreIfCenterVisible?: boolean;
}
export const flyTo = createAction(
  'map/flyTo',
  (to: Partial<ViewAt>, options: FlyToOptions = {}) => ({
    payload: { to, options },
  }),
);

export const mapClick = createAction<MapPointerEvent>('map/mapClick');

// Controls
export const requestGeolocation = createAction('map/requestGeolocation');
export const zoomIn = createAction('map/zoomIn');
export const zoomOut = createAction('map/zoomOut');
export const requestFullscreen = createAction('map/requestFullscreen'); // Requires transient user activation
export const exitFullscreen = createAction('map/exitFullscreen');

// Selectors

const select = (s: RootState) => s.map;

export const selectData = (s) => select(s).data;
export const selectDataLoaded = (s) => !!select(s).data;
export const selectId = (s) => select(s).id;
export const selectLocalAware = (s) => select(s).localAware;
export const selectLayers = (s) => select(s).data?.layers || [];
export const selectIs3d = (s) => select(s).data?.is3d ?? false;
export const selectGeolocation = (s) => select(s).geolocation;
export const selectTokens = (s) => select(s).tokens;
export const selectViewAt = (s) => select(s).localAware.viewAt;
export const selectEnableLocalSave = (s) => select(s).enableLocalSave;
const selectPeers = (s) => select(s).peerAwares || {};

// Features

export const selectInCreate = (s) => !!select(s).creating;

export const selectFeatures = (s) => select(s).data?.features || {};

export const selectActiveFeature = (s): ActiveFeature => {
  const map = selectFeatures(s);
  const id = select(s).localAware.activeFeature;
  if (!id) return;
  const feature = map[id];
  if (!feature) return;

  if (!['group', 'route', 'point'].includes(feature.type)) {
    console.warn('Unexpected active feature', feature);
    return;
  }

  return feature as any;
};

export const selectIsActiveFeature = (id: string) => (s) =>
  selectActiveFeature(s)?.id === id;

export const selectPeersActiveOnFeature = (id: string) =>
  createSelector([selectPeers], (peers) =>
    Object.values(peers).filter((peer) => peer.activeFeature === id),
  );

export const selectFeaturesDisplayList = (parentId: string) =>
  createSelector([selectFeatures], (features) =>
    computeFeaturesDisplayList(parentId, features),
  );

// Layers

export const selectLayerSourceDisplayList = (state) => {
  const layers = selectLayers(state);
  if (!layers) return [];

  const used = {};
  for (const layer of layers) {
    used[layer.sourceId] = true;
  }

  const list = Object.values(select(state).layerSources).filter(
    (v) => !used[v.id],
  );

  return sortBy(list, (v) => v.name);
};

export const selectLayerSources = (s) => select(s).layerSources;
export const selectLayerDatas = (s) => select(s).layerDatas;

export const selectLayerSource = (id: number) => (s) =>
  select(s).layerSources[id];

export const selectShouldCreditOS = createSelector(
  [selectLayers, selectLayerSources, selectLayerDatas],
  (layers, layerSources, dataSources) => {
    if (!layers) return false;
    return layers
      .map((view) => layerSources[view.sourceId])
      .flatMap((layerSource) => layerSource.dependencies)
      .map((dataSourceId) => dataSources[dataSourceId])
      .some((dataSource) => dataSource.attribution === 'os');
  },
);

function sortBy<T, B>(list: T[], key: (item: T) => B) {
  return list.slice().sort((a, b) => {
    const keyA = key(a);
    const keyB = key(b);
    if (keyA < keyB) return -1;
    if (keyA > keyB) return 1;
    return 0;
  });
}

// Listeners

startListening({
  actionCreator: mapClick,
  effect: ({ payload }, l) => {
    const state = select(l.getState());
    const creating = state.creating;
    if (creating) {
      const { type, at } = creating;

      if (type === 'point') {
        l.dispatch(
          actions.finishCreating({
            id: uuid(),
            at,
            type: 'point',
            lngLat: serializeLngLat(payload.lngLat),
          }),
        );
      }
    }
  },
});

startListening({
  actionCreator: zoomIn,
  effect: (_action, l) => {
    const current = selectViewAt(l.getState());
    if (!current) return;
    l.dispatch(flyTo({ zoom: Math.round(current.zoom + 1) }));
  },
});

startListening({
  actionCreator: zoomOut,
  effect: (_action, l) => {
    const current = selectViewAt(l.getState());
    if (!current) return;
    l.dispatch(flyTo({ zoom: Math.round(current.zoom - 1) }));
  },
});

startListening({
  actionCreator: requestFullscreen,
  effect: async (_action, l) => {
    if (document.fullscreenElement) {
      console.info('Suppressing requestFullscreen as already fullscreen');
      return;
    }

    if (!document.fullscreenEnabled) {
      l.dispatch(
        flash({
          kind: 'error',
          title: 'Fullscreen disabled',
          body: 'Your browser indicated fullscreen is disabled',
        }),
      );
    }

    try {
      await window.appNode.requestFullscreen({ navigationUI: 'hide' });
    } catch (e) {
      if (e instanceof TypeError) {
        l.dispatch(
          flash({
            kind: 'error',
            title: 'Error',
            body: 'Your browser refused to enter fullscreen mode',
          }),
        );
      } else {
        throw e;
      }
    }
  },
});

startListening({
  actionCreator: exitFullscreen,
  effect: async (_action, _l) => {
    if (!document.fullscreenElement) {
      console.info('Suppressing exitFullscreen as not fullscreen');
      return;
    }
    await document.exitFullscreen();
  },
});

startListening({
  matcher: isAnyOf(requestGeolocation, clearGeolocation),
  effect: async (action, l) => {
    if (action.type === clearGeolocation.type) {
      l.cancelActiveListeners();
      return;
    }

    const prev = selectGeolocation(l.getState());
    l.dispatch(
      actions.setGeolocation({
        updating: true,
        value: prev.value,
      }),
    );

    // Remember cancelling this listener cancels the fork, but the underlying
    // request still runs to completion.
    const result = await l.fork<GeolocationPosition>(
      (_f) =>
        new Promise((res, rej) => {
          navigator.geolocation.getCurrentPosition(res, rej, {
            maximumAge: 1000 * 60 * 60 * 24 * 7,
            timeout: 1000 * 10,
            enableHighAccuracy: true,
          });
        }),
    ).result;

    if (result.status === 'ok') {
      const { accuracy, latitude, longitude } = result.value.coords;
      const position: LngLat = [longitude, latitude];

      l.dispatch(
        actions.setGeolocation({
          updating: false,
          value: { accuracy, position },
        }),
      );

      l.dispatch(flyTo({ center: position }, { ignoreIfCenterVisible: true }));
    } else if (result.status === 'cancelled') {
      // We received clearGeolocation
    } else if (result.status === 'rejected') {
      const err = result.error;
      if (!(err instanceof GeolocationPositionError)) {
        throw err;
      }

      l.dispatch(actions.setGeolocation({ updating: false, value: undefined }));

      if (err.code === GeolocationPositionError.PERMISSION_DENIED) {
        l.dispatch(
          flash({
            kind: 'error',
            title: 'Location permission denied',
          }),
        );
      } else if (
        err.code === GeolocationPositionError.POSITION_UNAVAILABLE ||
        err.code === GeolocationPositionError.TIMEOUT
      ) {
        l.dispatch(
          flash({
            kind: 'error',
            title: 'Location unavailable',
          }),
        );
      } else {
        throw new Error(
          `Unexpected GeolocationPositionError code: ${err.code} msg: ${err.message}`,
        );
      }
    }
  },
});

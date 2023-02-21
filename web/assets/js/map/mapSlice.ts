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
import {
  JsonObject,
  JsonTemplateArray,
  JsonTemplateObject,
} from '@sanalabs/json';

interface MapState {
  tokens: Tokens;
  layerDatas: {
    [id: string]: LayerData;
  };
  layerSources: {
    [id: number]: LayerSource;
  };
  id: string;
  awareness?: Awareness;
  peerAwareness: Awareness[];
  layers: Layer[];
  features?: unknown; // TODO
  viewAt: ViewAt;
  geolocation: Geolocation;
}

const todoPreload =
  document.getElementById('map-app-root')!.dataset.preloadedState!;
const initialState: MapState = {
  // TODO
  tokens: JSON.parse(todoPreload).map.tokens,
  layerDatas: JSON.parse(todoPreload).map.viewDataSources,
  layerSources: JSON.parse(todoPreload).map.viewLayerSources,
  id: 'c2f85ed1-38e3-444c-b6bc-ae33a831ca5a',
  awareness: undefined,
  peerAwareness: [],
  layers: [],
  features: undefined,
  viewAt: JSON.parse(todoPreload).map.viewAt,
  geolocation: {
    updating: false,
  },
};

export interface Awareness {
  clientId: number;
  isCurrentClient: boolean;
}

interface Tokens {
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
  id: number;
  name: string;
  defaultOpacity: number | null;
  dependencies: string[];
  icon: string;
  glyphs: string | null;
  sprite: string | null;
  layerSpecs: ml.LayerSpecification[];
}

export interface Layer {
  sourceId: number;
  opacity: number;
}

interface MapClick {
  geo: LngLat;
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

export const mapSlice = createSlice({
  name: 'map',
  initialState,
  reducers: {
    // The map instance is the source of truth
    reportViewAt(state, { payload }: PayloadAction<ViewAt>) {
      state.viewAt = payload;
    },

    remoteSetLayers(state, { payload }: PayloadAction<JsonTemplateArray>) {
      state.layers = payload as unknown as MapState['layers'];
    },
    remoteSetFeatures(state, { payload }: PayloadAction<JsonTemplateObject>) {
      state.features = payload as unknown as MapState['features'];
    },
    remoteSetPeerAwareness(state, { payload }: PayloadAction<JsonObject[]>) {
      state.peerAwareness = payload as unknown as MapState['peerAwareness'];
    },

    updateLayer(
      state,
      { payload }: PayloadAction<{ idx: number; value: Partial<Layer> }>,
    ) {
      const layer = state.layers[payload.idx];
      for (const prop in payload.value) {
        layer[prop] = payload.value[prop];
      }
    },
    removeLayer(state, { payload }: PayloadAction<number>) {
      state.layers.splice(payload, 1);
    },
    addLayer(
      state,
      { payload: { sourceId } }: PayloadAction<{ sourceId: number }>,
    ) {
      const source = state.layerSources[sourceId];
      state.layers.push({
        sourceId: sourceId,
        opacity: source.defaultOpacity || 1.0,
      });
    },
    setLayers(state, { payload }: PayloadAction<Layer[]>) {
      state.layers = payload;
    },

    setGeolocation(state, { payload }: PayloadAction<Geolocation>) {
      state.geolocation = payload;
    },
    clearGeolocation(state, _action: PayloadAction<undefined>) {
      state.geolocation = { updating: false };
    },
  },
});

// Actions

export const {
  reportViewAt,
  remoteSetLayers,
  remoteSetFeatures,
  remoteSetPeerAwareness,
  clearGeolocation,
  updateLayer,
  removeLayer,
  addLayer,
  setLayers,
} = mapSlice.actions;

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

// Emitted by map
export const mapClick = createAction<MapClick>('map/mapClick');

export const requestGeolocation = createAction('map/requestGeolocation');
export const zoomIn = createAction('map/zoomIn');
export const zoomOut = createAction('map/zoomOut');
export const requestFullscreen = createAction('map/requestFullscreen'); // Requires transient user activation
export const exitFullscreen = createAction('map/exitFullscreen');

// Listeners

// TODO
// startListening({
//   actionCreator: reportViewAt,
//   effect: async ({ payload }, l) => {
//     const mapId = selectMapId(l.getState());
//     l.cancelActiveListeners();
//     try {
//       await l.delay(REPORT_VIEW_AT_DEBOUNCE_MS);
//       api.reportViewAt(mapId, payload);
//     } catch (e) {
//       if (e.code === "listener-cancelled") {
//         // Handover responsibility to to the subsequent effect that cancelled us
//       } else {
//         throw e;
//       }
//     }
//   },
// });

startListening({
  actionCreator: zoomIn,
  effect: (_action, l) => {
    const current = selectViewAt(l.getState());
    l.dispatch(flyTo({ zoom: Math.round(current.zoom + 1) }));
  },
});

startListening({
  actionCreator: zoomOut,
  effect: (_action, l) => {
    const current = selectViewAt(l.getState());
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
      mapSlice.actions.setGeolocation({
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
        mapSlice.actions.setGeolocation({
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

      l.dispatch(
        mapSlice.actions.setGeolocation({ updating: false, value: undefined }),
      );

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

// Selectors

const select = (s: RootState) => s.map;

export const selectId = (s) => select(s).id;
export const selectAwareness = (s) => select(s).awareness;
export const selectLayers = (s) => select(s).layers;
export const selectFeatures = (s) => select(s).features;
export const selectGeolocation = (s) => select(s).geolocation;
export const selectTokens = (s) => select(s).tokens;
export const selectViewAt = (s) => select(s).viewAt;

export const selectLayerSourceDisplayList = (state) => {
  const layers = selectLayers(state);

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
  (layers, layerSources, dataSources) =>
    layers
      .map((view) => layerSources[view.sourceId])
      .flatMap((layerSource) => layerSource.dependencies)
      .map((dataSourceId) => dataSources[dataSourceId])
      .some((dataSource) => dataSource.attribution === 'os'),
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

export default mapSlice.reducer;

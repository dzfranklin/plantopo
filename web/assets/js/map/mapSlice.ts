import {
  createAction,
  createSelector,
  createSlice,
  isAnyOf,
  PayloadAction,
} from "@reduxjs/toolkit";
import * as ml from "maplibre-gl";
import type { RootState } from "./store";
import * as api from "./api";
import { startListening } from "./listener";
import { flash } from "./flashSlice";
import { JsonTemplateObject } from "@sanalabs/json";

const REPORT_VIEW_AT_DEBOUNCE_MS = 300;

interface MapState {
  tokens: Tokens;
  viewDataSources: {
    [id: string]: ViewDataSource;
  };
  viewLayerSources: {
    [id: number]: ViewLayerSource;
  };
  id: number;
  myAwareness: any;
  awareness: any[];
  viewLayers: ViewLayer[];
  overrideViewLayers: ViewLayer[] | undefined;
  features?: any; // TODO
  viewAt: ViewAt;
  geolocation: Geolocation;
}

const initialState: MapState = {
  // TODO
  tokens: JSON.parse(
    document.getElementById("map-app-root")!.dataset.preloadedState
  ).map.tokens,
  viewDataSources: JSON.parse(
    document.getElementById("map-app-root")!.dataset.preloadedState
  ).map.viewDataSources,
  viewLayerSources: JSON.parse(
    document.getElementById("map-app-root")!.dataset.preloadedState
  ).map.viewLayerSources,
  id: 1,
  myAwareness: {},
  awareness: [],
  viewLayers: [],
  overrideViewLayers: undefined,
  features: undefined,
  viewAt: JSON.parse(
    document.getElementById("map-app-root")!.dataset.preloadedState
  ).map.viewAt,
  geolocation: {
    updating: false,
  },
};

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

export interface ViewDataSource {
  id: number;
  attribution?: string;
  spec: ml.SourceSpecification;
}

export interface ViewLayerSource {
  id: number;
  name: string;
  defaultOpacity: number | null;
  dependencies: string[];
  icon: string;
  glyphs: string | null;
  sprite: string | null;
  layerSpecs: ml.LayerSpecification[];
}

export interface ViewLayer {
  sourceId: number;
  opacity: number;
}

interface MapClick {
  geo: LngLat;
  screen: XY;
  features: {
    layer: string;
    properties: { [_: string]: any };
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
  name: "map",
  initialState,
  reducers: {
    // The map instance is the source of truth
    reportViewAt(state, { payload }: PayloadAction<ViewAt>) {
      state.viewAt = payload;
    },

    remoteSetViewLayers(state, { payload }: PayloadAction<JsonTemplateObject>) {
      state.viewLayers = payload as unknown as MapState["viewLayers"];
    },
    remoteSetFeatures(state, { payload }: PayloadAction<JsonTemplateObject>) {
      state.features = payload as unknown as MapState["features"];
    },
    remoteSetAwareness(state, { payload }: PayloadAction<any>) {
      state.awareness = payload;
    },

    overrideViewLayers(
      state,
      { payload }: PayloadAction<ViewLayer[] | undefined>
    ) {
      if (payload) {
        state.overrideViewLayers = payload;
      } else {
        state.overrideViewLayers = state.viewLayers;
      }
    },
    updateOverrideViewLayer(
      state,
      { payload }: PayloadAction<{ idx: number; value: Partial<ViewLayer> }>
    ) {
      const layer = state.overrideViewLayers[payload.idx];
      for (const prop in payload.value) {
        layer[prop] = payload.value[prop];
      }
    },
    removeOverrideViewLayer(state, { payload }: PayloadAction<number>) {
      state.overrideViewLayers.splice(payload, 1);
    },
    addOverrideViewLayer(
      state,
      { payload: { sourceId } }: PayloadAction<{ sourceId: number }>
    ) {
      const source = state.viewLayerSources[sourceId];
      state.overrideViewLayers.push({
        sourceId: sourceId,
        opacity: source.defaultOpacity || 1.0,
      });
    },
    clearOverrideViewLayers(state, _action: PayloadAction<undefined>) {
      state.overrideViewLayers = undefined;
    },
    saveOverrideViewLayers(state, _action: PayloadAction<undefined>) {
      state.viewLayers = state.overrideViewLayers;
      state.overrideViewLayers = undefined;
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
  remoteSetViewLayers,
  remoteSetFeatures,
  remoteSetAwareness,
  overrideViewLayers,
  clearOverrideViewLayers,
  clearGeolocation,
  updateOverrideViewLayer,
  saveOverrideViewLayers,
  removeOverrideViewLayer,
  addOverrideViewLayer,
} = mapSlice.actions;

// Intercepted by map
interface FlyToOptions {
  ignoreIfCenterVisible?: boolean;
}
export const flyTo = createAction(
  "map/flyTo",
  (to: Partial<ViewAt>, options: FlyToOptions = {}) => ({
    payload: { to, options },
  })
);

// Emitted by map
export const mapClick = createAction<MapClick>("map/mapClick");

export const requestGeolocation = createAction("map/requestGeolocation");
export const zoomIn = createAction("map/zoomIn");
export const zoomOut = createAction("map/zoomOut");
export const requestFullscreen = createAction("map/requestFullscreen"); // Requires transient user activation
export const exitFullscreen = createAction("map/exitFullscreen");

// Listeners

startListening({
  actionCreator: reportViewAt,
  effect: async ({ payload }, l) => {
    const mapId = selectMapId(l.getState());
    l.cancelActiveListeners();
    try {
      await l.delay(REPORT_VIEW_AT_DEBOUNCE_MS);
      api.reportViewAt(mapId, payload);
    } catch (e) {
      if (e.code === "listener-cancelled") {
        // Handover responsibility to to the subsequent effect that cancelled us
      } else {
        throw e;
      }
    }
  },
});

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
      console.info("Suppressing requestFullscreen as already fullscreen");
      return;
    }

    if (!document.fullscreenEnabled) {
      l.dispatch(
        flash({
          kind: "error",
          title: "Fullscreen disabled",
          body: "Your browser indicated fullscreen is disabled",
        })
      );
    }

    try {
      await window.appNode.requestFullscreen({ navigationUI: "hide" });
    } catch (e) {
      if (e instanceof TypeError) {
        l.dispatch(
          flash({
            kind: "error",
            title: "Error",
            body: "Your browser refused to enter fullscreen mode",
          })
        );
      } else {
        throw e;
      }
    }
  },
});

startListening({
  actionCreator: exitFullscreen,
  effect: async (_action, l) => {
    if (!document.fullscreenElement) {
      console.info("Suppressing exitFullscreen as not fullscreen");
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
      })
    );

    // Remember cancelling this listener cancels the fork, but the underlying
    // request still runs to completion.
    let result = await l.fork<GeolocationPosition>(
      (_f) =>
        new Promise((res, rej) => {
          navigator.geolocation.getCurrentPosition(res, rej, {
            maximumAge: 1000 * 60 * 60 * 24 * 7,
            timeout: 1000 * 10,
            enableHighAccuracy: true,
          });
        })
    ).result;

    if (result.status === "ok") {
      const { accuracy, latitude, longitude } = result.value.coords;
      const position: LngLat = [longitude, latitude];

      l.dispatch(
        mapSlice.actions.setGeolocation({
          updating: false,
          value: { accuracy, position },
        })
      );

      l.dispatch(flyTo({ center: position }, { ignoreIfCenterVisible: true }));
    } else if (result.status === "cancelled") {
    } else if (result.status === "rejected") {
      let err = result.error;
      if (!(err instanceof GeolocationPositionError)) {
        throw err;
      }

      if (err.code === GeolocationPositionError.PERMISSION_DENIED) {
        l.dispatch(
          flash({
            kind: "error",
            title: "Location permission denied",
          })
        );
      } else if (
        err.code === GeolocationPositionError.POSITION_UNAVAILABLE ||
        err.code === GeolocationPositionError.TIMEOUT
      ) {
        l.dispatch(
          flash({
            kind: "error",
            title: "Location unavailable",
          })
        );
      } else {
        throw new Error(
          `Unexpected GeolocationPositionError code: ${err.code} msg: ${err.message}`
        );
      }
    }
  },
});

startListening({
  actionCreator: saveOverrideViewLayers,
  effect: async (_action, l) => {
    // TODO
    console.warn("TODO save overrideViewLayers");
  },
});

// Selectors

const select = (s: RootState) => s.map;

export const selectMyAwareness = (s) => select(s).myAwareness;
export const selectViewLayersJSON = (s) =>
  select(s).viewLayers as unknown as JsonTemplateObject;
export const selectFeaturesJSON = (s) =>
  select(s).features as unknown as JsonTemplateObject;

export const selectGeolocation = (s) => select(s).geolocation;

const selectMapId = (s) => select(s).id;

export const selectTokens = (s) => select(s).tokens;

export const selectViewAt = (s) => select(s).viewAt;

export const selectViewLayerSourceDisplayList = (state) => {
  const layers = select(state).overrideViewLayers || select(state).viewLayers;

  const used = {};
  for (const layer of layers) {
    used[layer.sourceId] = true;
  }

  const list = Object.values(select(state).viewLayerSources).filter(
    (v) => !used[v.id]
  );

  return sortBy(list, (v) => v.name);
};

export const selectViewLayers = (s) =>
  select(s).overrideViewLayers || select(s).viewLayers;

export const selectViewLayerSources = (s) => select(s).viewLayerSources;
export const selectViewDataSources = (s) => select(s).viewDataSources;

export const selectViewLayerSource = (id: number) => (s) =>
  select(s).viewLayerSources[id];

export const selectShouldCreditOS = createSelector(
  [selectViewLayers, selectViewLayerSources, selectViewDataSources],
  (layers, layerSources, dataSources) =>
    layers
      .map((view) => layerSources[view.sourceId])
      .flatMap((layerSource) => layerSource.dependencies)
      .map((dataSourceId) => dataSources[dataSourceId])
      .some((dataSource) => dataSource.attribution === "os")
);

function sortBy<T>(list: T[], key: (item: T) => any) {
  return list.slice().sort((a, b) => {
    const keyA = key(a);
    const keyB = key(b);
    if (keyA < keyB) return -1;
    if (keyA > keyB) return 1;
    return 0;
  });
}

export default mapSlice.reducer;

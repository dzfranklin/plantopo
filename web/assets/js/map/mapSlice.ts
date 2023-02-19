import {
  createAction,
  createSelector,
  createSlice,
  isAnyOf,
  PayloadAction,
} from "@reduxjs/toolkit";
import { v4 as uuid } from "uuid";
import * as ml from "maplibre-gl";
import type { RootState } from "./store";
import * as api from "./api";
import { startListening } from "./listener";
import { flash } from "./flashSlice";

const REPORT_VIEW_AT_DEBOUNCE_MS = 300;

interface MapState {
  tokens: Tokens;
  viewDataSources: {
    [id: string]: ViewDataSource;
  };
  viewLayerSources: {
    [id: number]: ViewLayerSource;
  };
  map: {
    id: number;
    viewLayers: ViewLayer[];
    features: any; // TODO
  };
  viewAt: ViewAt;
  overrideViewLayers: ViewLayer[] | undefined;
  geolocation: Geolocation;
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
  id: string;
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
  initialState: {} as MapState,
  reducers: {
    // The map instance is the source of truth
    reportViewAt(state, { payload }: PayloadAction<ViewAt>) {
      state.viewAt = payload;
    },

    overrideViewLayers(
      state,
      { payload }: PayloadAction<ViewLayer[] | undefined>
    ) {
      if (payload) {
        state.overrideViewLayers = payload;
      } else {
        state.overrideViewLayers = state.map.viewLayers;
      }
    },
    updateOverrideViewLayer(
      state,
      { payload }: PayloadAction<{ layer: string; value: Partial<ViewLayer> }>
    ) {
      const layer = state.overrideViewLayers.find(
        (l) => l.id === payload.layer
      );

      for (const prop in payload.value) {
        layer[prop] = payload.value[prop];
      }
    },
    removeOverrideViewLayer(state, { payload }: PayloadAction<string>) {
      state.overrideViewLayers = state.overrideViewLayers.filter(
        (l) => l.id !== payload
      );
    },
    addOverrideViewLayer(
      state,
      { payload: { sourceId } }: PayloadAction<{ sourceId: number }>
    ) {
      const source = state.viewLayerSources[sourceId];
      state.overrideViewLayers.push({
        id: uuid(),
        sourceId: sourceId,
        opacity: source.defaultOpacity || 1.0,
      });
    },
    clearOverrideViewLayers(state, _action: PayloadAction<undefined>) {
      state.overrideViewLayers = undefined;
    },
    saveOverrideViewLayers(state, _action: PayloadAction<undefined>) {
      state.map.viewLayers = state.overrideViewLayers;
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

export const selectGeolocation = (s) => select(s).geolocation;

const selectMapId = (s) => select(s).map.id;

export const selectTokens = (s) => select(s).tokens;

export const selectViewAt = (s) => select(s).viewAt;

export const selectViewLayerSourceDisplayList = (state) => {
  const layers =
    select(state).overrideViewLayers || select(state).map.viewLayers;

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
  select(s).overrideViewLayers || select(s).map.viewLayers;

export const selectViewLayerSource = (id: number) => (s) =>
  select(s).viewLayerSources[id];

export const selectShouldCreditOS = (state) =>
  select(state)
    .map.viewLayers.map((view) => select(state).viewLayerSources[view.sourceId])
    .flatMap((layerSource) => layerSource.dependencies)
    .map((dataSourceId) => select(state).viewDataSources[dataSourceId])
    .some((dataSource) => dataSource.attribution === "os");

const ATTRIBUTION = {
  os: `Contains OS data &copy; Crown copyright and database rights ${new Date().getFullYear()}`,
  mapbox: `© <a href="https://www.mapbox.com/about/maps/">Mapbox</a> © <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a> <strong><a href="https://www.mapbox.com/map-feedback/" target="_blank">Improve this map</a></strong>`,
};

export const glLayerId = (sourceLayerId: number, specId: string) =>
  `${sourceLayerId}-${specId}`;

const OPACITY_PROPS = {
  background: ["background-opacity"],
  fill: ["fill-opacity"],
  line: ["line-opacity"],
  symbol: [], // Skipping "icon-opacity", "text-opacity"
  raster: ["raster-opacity"],
  circle: ["circle-opacity", "circle-stroke-opacity"],
  "fill-extrusion": ["fill-extrusion-opacity"],
  heatmap: ["heatmap-opacity"],
  hillshade: ["hillshade-exaggeration"],
};

export const selectGLStyle = createSelector(
  [
    (s) => select(s).viewDataSources,
    (s) => select(s).viewLayerSources,
    (s) => select(s).overrideViewLayers || select(s).map.viewLayers,
  ],
  (dataSources, layerSources, layers): ml.StyleSpecification => {
    const style: Partial<ml.StyleSpecification> = {
      version: 8,
    };

    const activeSources = layers.map((l) => layerSources[l.sourceId]);
    const glyphs = activeSources.find((s) => s.glyphs)?.glyphs;
    const sprite = activeSources.find((s) => s.sprite)?.sprite;
    if (glyphs) style.glyphs = glyphs;
    if (sprite) style.sprite = sprite;

    const mlSourceList = Object.values(dataSources).map((s) => {
      let spec = { ...s.spec } as any;
      if (s.attribution) spec.attribution = ATTRIBUTION[s.attribution];
      return [s.id, spec];
    });
    style.sources = Object.fromEntries(mlSourceList);

    style.layers = layers.flatMap((layer, layerIdx) => {
      const source = layerSources[layer.sourceId];

      const specs: ml.LayerSpecification[] = [];
      for (const sourceSpec of source.layerSpecs) {
        const spec: ml.LayerSpecification = {
          ...sourceSpec,
          id: glLayerId(source.id, sourceSpec.id),
        };

        if (layer.opacity < 1 && layerIdx !== 0) {
          spec.paint = { ...spec.paint };
          for (const prop of OPACITY_PROPS[sourceSpec.type]) {
            spec.paint[prop] = (spec.paint[prop] || 1.0) * layer.opacity;
          }
        }

        specs.push(spec);
      }

      return specs;
    });

    return style as ml.StyleSpecification;
  }
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

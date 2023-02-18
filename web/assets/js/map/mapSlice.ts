import {
  createAction,
  createSelector,
  createSlice,
  PayloadAction,
} from "@reduxjs/toolkit";
import {
  LayerSpecification as GLLayerSpecification,
  SourceSpecification as GLSourceSpecification,
  StyleSpecification as GLStyleSpecification,
} from "maplibre-gl";
import type { RootState } from "./store";
import * as api from "./api";
import { startListening } from "./listener";
import { flash } from "./flashSlice";
import { castDraft } from "immer";
import { v4 as uuid } from "uuid";

const REPORT_VIEW_AT_DEBOUNCE_MS = 300;

interface MapState {
  tokens: Tokens;
  map: {
    id: number;
    viewAt: ViewAt;
    viewDataSources: {
      [id: string]: ViewDataSource;
    };
    viewLayerSources: {
      [id: number]: ViewLayerSource;
    };
    view: View;
    features: any; // TODO
  };
  viewEditor: {
    state: "closed" | "loading" | "active" | "save-wait";
    unchanged?: View;
  };
}

interface Tokens {
  mapbox: string;
  os: string;
}

export interface View {
  id: number | undefined;
  name: string;
  layers: ViewLayer[];
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
  creditOS: boolean;
  spec: GLSourceSpecification;
}

export interface ViewLayerSource {
  id: number;
  name: string;
  glyphs: string | null;
  sprite: string | null;
  layerSpecs: GLLayerSpecification[];
}

export interface ViewLayer {
  id: string;
  sourceId: number;
  opacity: number;
  propOverrides: PropOverride[];
}

type PropOverride = (
  | { layerId: string; layerType: null }
  | { layerType: string; layerId: null }
) & {
  id: string;
  comment: string;
  propertyName: string;
  propertyCategory: "paint" | "layout";
  value: any;
};

interface MapClick {
  geo: LngLat;
  screen: XY;
  features: {
    layer: string;
    properties: { [_: string]: any };
  }[];
}

export const mapSlice = createSlice({
  name: "map",
  initialState: {} as MapState,
  reducers: {
    // The map instance is the source of truth for viewAt.
    reportViewAt(state, { payload }: PayloadAction<ViewAt>) {
      state.map.viewAt = payload;
    },

    // View editor

    editView(state, _action: PayloadAction<null>) {
      state.viewEditor = {
        state: "loading",
        unchanged: state.map.view,
      };
    },

    editViewLoaded(
      state,
      {
        payload,
      }: PayloadAction<{
        layerSources: { [_: number]: ViewLayerSource };
        dataSources: { [_: string]: ViewDataSource };
      }>
    ) {
      state.map.viewLayerSources = {
        ...state.map.viewLayerSources,
        ...castDraft(payload.layerSources),
      };
      state.map.viewDataSources = {
        ...state.map.viewDataSources,
        ...castDraft(payload.dataSources),
      };
      state.viewEditor.state = "active";
    },

    closeViewEditor(state, { payload }: PayloadAction<{ discard: boolean }>) {
      if (!payload.discard) {
        state.viewEditor.state = "save-wait";
      } else {
        state.map.view = state.viewEditor.unchanged!;
        state.viewEditor.state = "closed";
      }
    },

    closeViewEditorSaveFailed(state, _action: PayloadAction<null>) {
      state.viewEditor.state = "active";
    },

    closeViewEditorSaveSucceeded(
      state,
      action: PayloadAction<{ newViewId?: number }>
    ) {
      if (action.payload.newViewId !== undefined) {
        state.map.view.id = action.payload.newViewId;
      }
      state.viewEditor.state = "closed";
    },

    setViewName(state, { payload }: PayloadAction<string>) {
      state.map.view.name = payload;
    },

    addViewLayer(state, { payload }: PayloadAction<{ sourceId: number }>) {
      const layer = {
        id: uuid(),
        sourceId: payload.sourceId,
        opacity: 1,
        propOverrides: [],
      };
      state.map.view.layers = [layer, ...state.map.view.layers];
    },

    reorderViewLayers(state, { payload }: PayloadAction<string[]>) {
      const layers = {};
      for (const layer of state.map.view.layers) {
        layers[layer.id] = layer;
      }

      let out = new Array(payload.length);
      for (const idx in payload) {
        const id = payload[idx];
        const layer = layers[id];
        if (layer === undefined) {
          throw new Error(`reorderViewLayers: id not found: ${id}`);
        }
        out[idx] = layer;
      }

      state.map.view.layers = out;
    },

    setViewLayerOpacity(
      state,
      { payload }: PayloadAction<{ layer: string; value: number }>
    ) {
      const layer = state.map.view.layers.find((l) => l.id === payload.layer);
      layer.opacity = payload.value;
    },
  },
});

// Actions

// Intercepted by map
export const flyTo = createAction<ViewAt>("map/flyTo");

// Emitted by map
export const mapClick = createAction<MapClick>("map/mapClick");

export const {
  reportViewAt,
  editView,
  closeViewEditor,
  setViewName,
  addViewLayer,
  reorderViewLayers,
  setViewLayerOpacity,
} = mapSlice.actions;

// Listeners

startListening({
  actionCreator: reportViewAt,
  effect: async (action, l) => {
    const mapId = selectMapId(l.getState());
    l.cancelActiveListeners();
    try {
      await l.delay(REPORT_VIEW_AT_DEBOUNCE_MS);
      api.reportViewAt(mapId, action.payload);
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
  actionCreator: editView,
  effect: async (_action, l) => {
    const state = l.getState();
    const knownLayerSources = Object.values(selectViewLayerSources(state)).map(
      (s) => s.id
    );
    const knownDataSources = Object.keys(selectViewDataSources(state));
    const newData = await api.listViewSources(
      knownLayerSources,
      knownDataSources
    );
    l.dispatch(mapSlice.actions.editViewLoaded(newData));
  },
});

startListening({
  actionCreator: closeViewEditor,
  effect: async (action, l) => {
    if (!action.payload.discard) {
      let view = select(l.getState()).map.view;
      try {
        let resp = await api.saveView(view);

        let payload: { newViewId?: number } = {};
        if (view.id === undefined) {
          payload.newViewId = resp.id;
        }
        l.dispatch(mapSlice.actions.closeViewEditorSaveSucceeded(payload));
      } catch (e) {
        console.warn("Failed to save view", e);
        l.dispatch(mapSlice.actions.closeViewEditorSaveFailed(null));
      }
    }
  },
});

startListening({
  actionCreator: mapSlice.actions.closeViewEditorSaveSucceeded,
  effect: async (_action, l) => {
    l.dispatch(flash({ kind: "info", title: "View saved" }));
  },
});

startListening({
  actionCreator: mapSlice.actions.closeViewEditorSaveFailed,
  effect: async (_action, l) => {
    l.dispatch(flash({ kind: "error", title: "Failed to save view" }));
  },
});

// Selectors

const select = (state: RootState) => state.map;

export const selectViewEditorIsActive = (state: RootState) =>
  select(state).viewEditor.state !== "closed";

export const selectViewEditorState = (state: RootState) =>
  select(state).viewEditor.state;

const selectMapId = (state: RootState) => select(state).map.id;

export const selectTokens = (state: RootState) => select(state).tokens;

export const selectViewAt = (state: RootState) => select(state).map.viewAt;

export const selectShouldCreditOS = (state: RootState) =>
  Object.values(select(state).map.viewDataSources).some((s) => s.creditOS);

export const selectView = (state: RootState) => select(state).map.view;

export const selectViewLayer = (id: string) => (state: RootState) =>
  select(state).map.view.layers.find((l) => l.id === id);

const selectGlyphs = (state: RootState) => {
  let sources = Object.values(select(state).map.viewLayerSources);
  let glyphs: string | undefined;
  for (const source of sources) {
    if (source.glyphs) {
      if (glyphs) {
        throw new Error("Only one source can have glyphs.");
      } else {
        glyphs = source.glyphs;
      }
    }
  }
  return glyphs;
};

const selectSprite = (state: RootState) => {
  let sources = Object.values(select(state).map.viewLayerSources);
  let sprite: string | undefined;
  for (const source of sources) {
    if (source.sprite) {
      if (sprite) {
        throw new Error("Only one source can have sprite.");
      } else {
        sprite = source.sprite;
      }
    }
  }
  return sprite;
};

const selectViewDataSources = (state: RootState) =>
  select(state).map.viewDataSources;
export const selectViewLayerSources = (state: RootState) =>
  select(state).map.viewLayerSources;

export const selectViewLayerSource =
  (id: number) =>
  (state: RootState): ViewLayerSource =>
    select(state).map.viewLayerSources[id];

const selectViewLayers = (state: RootState) => select(state).map.view.layers;

const osAttribution = `Contains OS data &copy; Crown copyright and database rights ${new Date().getFullYear()}`;

export const glLayerId = (sourceLayerId: number, specId: string) =>
  `${sourceLayerId}-${specId}`;

export const selectGLStyle = createSelector(
  [
    selectGlyphs,
    selectSprite,
    selectViewDataSources,
    selectViewLayerSources,
    selectViewLayers,
  ],
  (
    glyphs,
    sprite,
    dataSources,
    layerSources,
    viewLayers
  ): GLStyleSpecification => {
    const sourceList = Object.values(dataSources).map((s) => {
      let spec = s.creditOS
        ? { ...s.spec, attribution: osAttribution }
        : s.spec;
      return [s.id, spec];
    });
    const sources = Object.fromEntries(sourceList);

    const layers = viewLayers.flatMap((layer) => {
      const source = layerSources[layer.sourceId];

      const specs: GLLayerSpecification[] = [];
      for (const sourceSpec of source.layerSpecs) {
        const paintOverrides = {};

        if (layer.opacity < 1) {
          if (sourceSpec.type === "fill") {
            paintOverrides["fill-opacity"] = layer.opacity;
          } else if (sourceSpec.type === "background") {
            paintOverrides["background-opacity"] = layer.opacity;
          } else if (sourceSpec.type === "raster") {
            paintOverrides["raster-opacity"] = layer.opacity;
          }
        }

        specs.push({
          ...sourceSpec,
          paint: { ...sourceSpec.paint, ...paintOverrides },
          id: glLayerId(source.id, sourceSpec.id),
        } as GLLayerSpecification);
      }

      return specs;
    });

    return {
      version: 8,
      glyphs,
      sprite,
      sources,
      layers,
    };
  }
);

export default mapSlice.reducer;

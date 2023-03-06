import { createSelector, createSlice, PayloadAction } from '@reduxjs/toolkit';
import sortBy from '../util/sortBy';
import { RootState } from '../store/store';
import { Layer, LayerDatas, LayerSource, LayerSources } from './types';

export interface State {
  datas: LayerDatas;
  sources: LayerSources;
  sync: {
    layers: Layer[];
    is3d: boolean;
  };
}

const initialState: State = {
  datas: {},
  sources: {},
  sync: {
    layers: [],
    is3d: false,
  },
};

const slice = createSlice({
  name: 'layers',
  initialState,
  reducers: {
    sync: (state, action: PayloadAction<State['sync']>) => {
      state.sync = action.payload;
    },

    updateLayer(
      state,
      { payload }: PayloadAction<{ idx: number; value: Partial<Layer> }>,
    ) {
      const layer = state.sync.layers[payload.idx];
      for (const prop in payload.value) {
        layer[prop] = payload.value[prop];
      }
    },
    removeLayer(state, { payload }: PayloadAction<number>) {
      state.sync.layers.splice(payload, 1);
    },
    addLayer(
      state,
      { payload: { sourceId } }: PayloadAction<{ sourceId: string }>,
    ) {
      const source = state.sources[sourceId];
      state.sync.layers.push({
        sourceId: sourceId,
        opacity: source.defaultOpacity || 1.0,
      });
    },
    setLayers(state, { payload }: PayloadAction<Layer[]>) {
      state.sync.layers = payload;
    },

    setIs3d(state, { payload }: PayloadAction<boolean>) {
      state.sync.is3d = payload;
    },
  },
});

export default slice.reducer;

export const { sync, updateLayer, removeLayer, addLayer, setLayers, setIs3d } =
  slice.actions;

// Selectors

export const selectLayers = (state: RootState): Layer[] =>
  state.layers.sync.layers;

export const selectIs3d = (state: RootState): boolean => state.layers.sync.is3d;

export const selectLayerSources = (state: RootState): LayerSources =>
  state.layers.sources;

export const selectLayerDatas = (state: RootState): LayerDatas =>
  state.layers.datas;

export const selectSprites = createSelector(
  [selectLayers, selectLayerSources],
  (layers, sources) => {
    return layers
      .map((l) => sources[l.sourceId])
      .filter((s) => !!s?.sprite)
      .map((s) => [s.id, s.sprite as string]);
  },
);

export const selectLayerSourceDisplayList = (state: RootState) => {
  const layers = selectLayers(state);
  const sources = selectLayerSources(state);

  const used = {};
  for (const layer of layers) {
    used[layer.sourceId] = true;
  }

  const list = Object.values(sources).filter((v) => !used[v.id]);

  return sortBy(list, (v) => v.name);
};

export const selectLayerSource =
  (id: number) =>
  (state: RootState): LayerSource =>
    selectLayerSources(state)[id];

export const selectShouldCreditOS = createSelector(
  [selectLayers, selectLayerSources, selectLayerDatas],
  (layers, layerSources, dataSources) => {
    if (!layers) return false;
    return layers
      .map((view) => layerSources[view.sourceId])
      .flatMap((layerSource) => layerSource?.dependencies)
      .map((dataSourceId) => dataSources[dataSourceId])
      .some((dataSource) => dataSource?.attribution === 'os');
  },
);

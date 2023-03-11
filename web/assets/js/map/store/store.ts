import { configureStore } from '@reduxjs/toolkit';
import flashReducer from '../flash/slice';
import mapReducer, { Tokens } from '../mapSlice';
import layersReducer from '../layers/slice';
import syncReducer from '../sync/slice';
import controlsReducer from '../controls/slice';
import featuresReducer from '../features/slice';
import sidebarReducer from '../sidebar/slice';
import { middleware as listenerMiddleware } from './listener';
import { AppStore } from './type';
import type { LayerDatas, LayerSources } from '../layers/types';

interface InitState {
  id: string;
  tokens: Tokens;
  layerDatas: LayerDatas;
  layerSources: LayerSources;
}

export const initStore = (initState: InitState): AppStore =>
  configureStore({
    reducer: {
      map: mapReducer,
      layers: layersReducer,
      sync: syncReducer,
      controls: controlsReducer,
      flash: flashReducer,
      features: featuresReducer,
      sidebar: sidebarReducer,
    },
    middleware: (getDefault) => getDefault().prepend(listenerMiddleware),
    preloadedState: {
      map: {
        id: initState.id,
        tokens: initState.tokens,
      },
      layers: {
        datas: initState.layerDatas,
        sources: initState.layerSources as any, // workaround recursive type instantiation
        sync: { layers: {}, is3d: false },
      },
    },
  });

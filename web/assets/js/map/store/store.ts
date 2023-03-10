import { configureStore } from '@reduxjs/toolkit';
import flashReducer from '../flash/slice';
import mapReducer from '../mapSlice';
import layersReducer from '../layers/slice';
import syncReducer from '../sync/slice';
import controlsReducer from '../controls/slice';
import featuresReducer from '../features/slice';
import sidebarReducer from '../sidebar/slice';
import { middleware as listenerMiddleware } from './listener';

export const initStore = (initState) =>
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
        sources: initState.layerSources,
        sync: { layers: {}, is3d: false },
      },
    },
  });

export type AppStore = ReturnType<typeof initStore>;
export type RootState = ReturnType<AppStore['getState']>;
export type AppDispatch = AppStore['dispatch'];

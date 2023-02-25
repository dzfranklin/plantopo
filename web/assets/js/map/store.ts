import { configureStore } from '@reduxjs/toolkit';
import flashReducer from './flashSlice';
import mapReducer from './mapSlice';
import { middleware as listenerMiddleware } from './listener';

export const initStore = (initState) =>
  configureStore({
    reducer: {
      map: mapReducer,
      flash: flashReducer,
    },
    middleware: (getDefault) => getDefault().prepend(listenerMiddleware),
    preloadedState: {
      map: {
        id: initState.id,
        tokens: initState.tokens,
        layerDatas: initState.layerDatas,
        layerSources: initState.layerSources,
        localAware: initState.localAware,
        enableLocalSave: true,
        onlineStatus: 'connecting',
        geolocation: {
          updating: false,
        },
      },
    },
  });

export type AppStore = ReturnType<typeof initStore>;
export type RootState = ReturnType<AppStore['getState']>;
export type AppDispatch = AppStore['dispatch'];

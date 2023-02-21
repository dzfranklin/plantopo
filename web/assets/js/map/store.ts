import { configureStore } from '@reduxjs/toolkit';
import flashReducer from './flashSlice';
import mapReducer from './mapSlice';
import { middleware as listenerMiddleware } from './listener';

export const initStore = () =>
  configureStore({
    reducer: {
      map: mapReducer,
      flash: flashReducer,
    },
    middleware: (getDefault) => getDefault().prepend(listenerMiddleware),
  });

export type AppStore = ReturnType<typeof initStore>;
export type RootState = ReturnType<AppStore['getState']>;
export type AppDispatch = AppStore['dispatch'];

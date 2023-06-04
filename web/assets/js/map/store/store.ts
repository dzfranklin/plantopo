import { configureStore } from '@reduxjs/toolkit';
import flashReducer from '../flash/slice';
import mapReducer, { Tokens } from '../mapSlice';
import controlsReducer from '../controls/slice';
import sidebarReducer from '../sidebar/slice';
import { middleware as listenerMiddleware } from './listener';
import { AppStore } from './type';

interface InitState {
  id: string;
  tokens: Tokens;
}

export const initStore = (initState: InitState): AppStore =>
  configureStore({
    reducer: {
      map: mapReducer,
      controls: controlsReducer,
      flash: flashReducer,
      sidebar: sidebarReducer,
    },
    middleware: (getDefault) => getDefault().prepend(listenerMiddleware),
    preloadedState: {
      map: {
        id: initState.id,
        tokens: initState.tokens,
      },
    },
  });

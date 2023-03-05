import {
  createListenerMiddleware,
  TypedStartListening,
  TypedStopListening,
} from '@reduxjs/toolkit';
import type { AppDispatch, RootState } from './store';

const listener = createListenerMiddleware();
export const middleware = listener.middleware;

export type AppStartListening = TypedStartListening<RootState, AppDispatch>;
export type AppStopListening = TypedStopListening<RootState, AppDispatch>;

export const startListening = listener.startListening as AppStartListening;
export const stopListening = listener.stopListening as AppStopListening;

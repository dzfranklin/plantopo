import { createAction, createSlice, PayloadAction } from '@reduxjs/toolkit';
import type { RootState } from './store/store';
import { ViewAt } from './ViewAt';

export interface MapState {
  tokens: Tokens;
  id: string;
  viewAt: ViewAt;
}

export interface Tokens {
  mapbox: string;
  os: string;
  maptiler: string;
}

const mapSlice = createSlice({
  name: 'map',
  initialState: null as unknown as MapState,
  reducers: {
    reportViewAt(state, { payload }: PayloadAction<ViewAt>) {
      state.viewAt = payload;
    },
  },
});

export default mapSlice.reducer;

// Actions

const actions = mapSlice.actions;
export const { reportViewAt } = actions;

// Intercepted by map
interface FlyToOptions {
  ignoreIfCenterVisible?: boolean;
}
export const flyTo = createAction(
  'map/flyTo',
  (to: Partial<ViewAt>, options: FlyToOptions = {}) => ({
    payload: { to, options },
  }),
);

// Selectors

const select = (s: RootState) => s.map;

export const selectId = (s) => select(s).id;
export const selectTokens = (s) => select(s).tokens;
export const selectViewAt = (s) => select(s).viewAt;

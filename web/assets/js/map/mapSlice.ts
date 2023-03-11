import { createAction, createSlice, PayloadAction } from '@reduxjs/toolkit';
import type { RootState } from './store/store';
import { ViewAt } from './ViewAt';

export interface MapState {
  tokens: Tokens;
  id: string;
  viewAt?: ViewAt;
  initialViewAt?: ViewAt | null;
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
    syncInitialViewAt(state, { payload }: PayloadAction<ViewAt>) {
      if (state.initialViewAt === null) {
        console.warn('Rejecting initial view at as timed out');
      } else {
        state.initialViewAt = payload;
      }
    },
    timeoutInitialViewAt(state, _action: PayloadAction<void>) {
      if (state.initialViewAt === undefined) {
        console.warn('Timed out initial view at');
        state.initialViewAt = null;
      }
    },
  },
});

export default mapSlice.reducer;

// Actions

const actions = mapSlice.actions;
export const { reportViewAt, syncInitialViewAt, timeoutInitialViewAt } =
  actions;

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
export const selectInitialViewAt = (s) => select(s).initialViewAt;

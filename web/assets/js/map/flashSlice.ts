import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { startListening } from './listener';
import type { RootState } from './store';

const INFO_CLEAR_AFTER = 3_000;

interface FlashState {
  active?: Flash;
}

export interface Flash {
  kind: 'info' | 'error';
  title: string;
  body?: string;
}

const initialState: FlashState = {
  active: undefined,
};

export const flashSlice = createSlice({
  name: 'flash',
  initialState,
  reducers: {
    flash(state, action: PayloadAction<Flash>) {
      state.active = action.payload;
    },

    clearFlash: {
      reducer(state, _action: PayloadAction<null>) {
        state.active = undefined;
      },
      prepare() {
        return { payload: null };
      },
    },

    autoClear(state, _action: PayloadAction<null>) {
      state.active = undefined;
    },
  },
});

export const { flash, clearFlash } = flashSlice.actions;

startListening({
  actionCreator: flash,
  effect: async (action, l) => {
    if (action.payload.kind === 'info') {
      l.cancelActiveListeners();
      try {
        await l.delay(INFO_CLEAR_AFTER);
      } catch (e) {
        if (e.code !== 'listener-cancelled') {
          throw e;
        }
      }
      l.dispatch(flashSlice.actions.autoClear(null));
    }
  },
});

export const selectActiveFlash = (state: RootState) => state.flash.active;

export default flashSlice.reducer;

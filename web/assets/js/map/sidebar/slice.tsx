import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { RootState } from '../store/type';

export interface State {
  isOpen: boolean;
}

const initialState: State = {
  isOpen: true,
};

const slice = createSlice({
  name: 'sidebar',
  initialState,
  reducers: {
    toggleOpen(state, _action: PayloadAction<void>) {
      state.isOpen = !state.isOpen;
    },
  },
});

export const { toggleOpen } = slice.actions;
export default slice.reducer;

export const selectSidebarOpen = (state: RootState) => state.sidebar.isOpen;

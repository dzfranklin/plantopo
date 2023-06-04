import type { MapState } from '../mapSlice';
import type { State as ControlsState } from '../controls/slice';
import type { FlashState } from '../flash/slice';
import type { State as SidebarState } from '../sidebar/slice';
import type { EnhancedStore } from '@reduxjs/toolkit';

export type RootState = {
  map: MapState;
  controls: ControlsState;
  flash: FlashState;
  sidebar: SidebarState;
};

export type AppStore = EnhancedStore<RootState>;

export type AppDispatch = AppStore['dispatch'];

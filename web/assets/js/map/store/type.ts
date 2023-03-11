import type { MapState } from '../mapSlice';
import type { State as LayersState } from '../layers/slice';
import type { State as SyncState } from '../sync/slice';
import type { State as ControlsState } from '../controls/slice';
import type { FlashState } from '../flash/slice';
import type { State as FeaturesState } from '../features/slice';
import type { State as SidebarState } from '../sidebar/slice';
import type { EnhancedStore } from '@reduxjs/toolkit';

export type RootState = {
  map: MapState;
  layers: LayersState;
  sync: SyncState;
  controls: ControlsState;
  flash: FlashState;
  features: FeaturesState;
  sidebar: SidebarState;
};

export type AppStore = EnhancedStore<RootState>;

export type AppDispatch = AppStore['dispatch'];

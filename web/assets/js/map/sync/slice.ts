import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { JsonObject, JsonTemplateObject } from '@sanalabs/json';
import { Layers } from '../layers/types';
import { startListening } from '../store/listener';
import * as layersSlice from '../layers/slice';
import * as featuresSlice from '../features/slice';
import { Features } from '../features/types';
import { RootState } from '../store/store';
import { Aware, PeerAware, SyncData } from './types';
import { CurrentUser } from '../../globals';

export interface State {
  user: CurrentUser | null;
  onlineStatus: 'connecting' | 'connected' | 'reconnecting';
  enableLocalSave: boolean;
  peerAwares: { [clientId: number]: PeerAware };
}

const searchParams = new URLSearchParams(location.search);
const disableLocalSave = searchParams.has('noLocal') ?? false;

const initialState: State = {
  user: window.currentUser,
  onlineStatus: 'connecting',
  enableLocalSave: !disableLocalSave,
  peerAwares: {},
};

export type SocketStatus = 'disconnected' | 'connecting' | 'connected';

const slice = createSlice({
  name: 'sync',
  initialState,
  reducers: {
    reportSocketStatus(state, { payload }: PayloadAction<SocketStatus>) {
      if (
        state.onlineStatus === 'connecting' ||
        state.onlineStatus === 'reconnecting'
      ) {
        if (payload === 'connected') {
          state.onlineStatus = 'connected';
        }
      } else if (state.onlineStatus === 'connected') {
        if (payload === 'disconnected' || payload === 'connecting') {
          state.onlineStatus = 'reconnecting';
        }
      }
    },
    reportUpdate(_state, _action: PayloadAction<JsonTemplateObject>) {},
    reportAwareUpdate(state, { payload }: PayloadAction<JsonObject[]>) {
      const list = payload as unknown as PeerAware[];
      state.peerAwares = {};
      for (const peer of list) {
        if (!peer.isCurrentClient) {
          state.peerAwares[peer.clientId] = peer;
        }
      }
    },
  },
});

export const { reportUpdate, reportSocketStatus, reportAwareUpdate } =
  slice.actions;

export default slice.reducer;

startListening({
  actionCreator: slice.actions.reportUpdate,
  effect: ({ payload }, l) => {
    const layers = (payload['layers'] ?? {}) as unknown as Layers;
    const is3d = (payload['is3d'] ?? false) as boolean;
    l.dispatch(layersSlice.sync({ layers, is3d }));

    const features = (payload['features'] ?? {}) as unknown as Features;
    const featureTrash = (payload['featureTrash'] ?? {}) as unknown as Features;
    l.dispatch(featuresSlice.sync({ features, featureTrash }));
  },
});

// Selectors

export const selectPeers = (state: RootState) => state.sync.peerAwares || {};

export const selectEnableLocalSave = (state: RootState) =>
  state.sync.enableLocalSave;

export const selectSyncData = (state: RootState): SyncData => {
  const { layers, is3d } = state.layers.sync;
  const { features, featureTrash } = state.features.sync;
  return { layers, is3d, features, featureTrash };
};

export const selectSyncLocalAware = (state: RootState): Aware => {
  const user = state.sync.user ?? undefined;
  const viewAt = state.map.viewAt;
  const activeFeature = state.features.active;
  return { user, viewAt, activeFeature };
};

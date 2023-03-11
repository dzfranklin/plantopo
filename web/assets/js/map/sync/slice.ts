import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { JsonObject, JsonTemplateObject } from '@sanalabs/json';
import { RootState } from '../store/type';
import { PeerAware } from './types';
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
    syncAction(_state, _action: PayloadAction<JsonTemplateObject>) {},
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

export const { syncAction, reportSocketStatus, reportAwareUpdate } =
  slice.actions;

export default slice.reducer;

// Selectors

export const selectPeers = (state: RootState) => state.sync.peerAwares;

export const selectEnableLocalSave = (state: RootState) =>
  state.sync.enableLocalSave;

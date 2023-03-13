import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { RootState } from '../store/type';
import { KNOWN_SYNC_DATA, PeerAwareData, SyncData } from './types';
import { CurrentUser } from '../../globals';

export interface State {
  user: CurrentUser | null;
  onlineStatus: 'connecting' | 'connected' | 'reconnecting';
  enableLocalSave: boolean;
  peerAwares: Record<number, PeerAwareData>;
  unknownData: Record<string, unknown>;
}

const searchParams = new URLSearchParams(location.search);
const disableLocalSave = searchParams.has('noLocal');

const initialState: State = {
  user: window.currentUser,
  onlineStatus: 'connecting',
  enableLocalSave: !disableLocalSave,
  peerAwares: {},
  unknownData: {},
};

export type SocketStatus = 'disconnected' | 'connecting' | 'connected';

const slice = createSlice({
  name: 'sync',
  initialState,
  reducers: {
    reportSocketStatus(state, { payload }: PayloadAction<SocketStatus>) {
      if (
        (state.onlineStatus === 'connecting' ||
          state.onlineStatus === 'reconnecting') &&
        payload === 'connected'
      ) {
        state.onlineStatus = 'connected';
      } else if (
        state.onlineStatus === 'connected' &&
        (payload === 'disconnected' || payload === 'connecting')
      ) {
        state.onlineStatus = 'reconnecting';
      }
    },
    syncData(state, { payload }: PayloadAction<SyncData>) {
      const isUnknown = ([k, _v]) => !KNOWN_SYNC_DATA.includes(k);
      state.unknownData = Object.fromEntries(
        Array.from(Object.entries(payload)).filter(isUnknown),
      );
    },
    syncPeerAwares(
      state,
      { payload }: PayloadAction<Record<number, PeerAwareData>>,
    ) {
      state.peerAwares = payload;
    },
  },
});

export const { syncData, reportSocketStatus, syncPeerAwares } = slice.actions;

export default slice.reducer;

// Selectors

export const selectPeers = (state: RootState) => state.sync.peerAwares;

export const selectEnableLocalSave = (state: RootState) =>
  state.sync.enableLocalSave;

import {
  createAction,
  createSelector,
  createSlice,
  PayloadAction,
} from '@reduxjs/toolkit';
import { castDraft } from 'immer';
import { RootState } from '../store/store';
import { selectPeers } from '../sync/slice';
import {
  computeAtAfter,
  computeFeaturesDisplayList,
  computeFeaturesList,
  deleteFeatures,
  Feature,
  Features,
  GroupFeature,
  parentIdOf,
  PointFeature,
  ROOT_FEATURE,
  RouteFeature,
} from './features';
import { v4 as uuid } from 'uuid';

export interface State {
  creating?: {
    type: string;
    at: string;
  };
  active?: string;
  sync: {
    features: Features;
    featureTrash: Features;
  };
}

const initialState: State = {
  creating: undefined,
  active: undefined,
  sync: {
    features: {},
    featureTrash: {},
  },
};

export type ActiveFeature =
  | GroupFeature
  | PointFeature
  | RouteFeature
  | undefined;

const slice = createSlice({
  name: 'features',
  initialState,
  reducers: {
    sync: (state, action: PayloadAction<State['sync']>) => {
      state.sync = action.payload;
    },

    setActive(state, { payload }: PayloadAction<string | undefined>) {
      state.active = payload;
    },
    moveActive(
      state,
      { payload }: PayloadAction<'down' | 'up' | 'in' | 'out'>,
    ) {
      const features = state.sync.features;
      const prevId = state.active;
      const prev = prevId ? features[prevId] : null;

      if (!prev) {
        const list = computeFeaturesDisplayList(ROOT_FEATURE, features);
        const next = list.at(0);
        if (next) state.active = next.id;
      } else if (payload === 'in') {
        if (prev.type !== 'group') return;
        const list = computeFeaturesDisplayList(prev.id, features);
        const next = list.at(0);
        if (next) state.active = next.id;
      } else if (payload === 'out') {
        const parentId = parentIdOf(prev);
        if (parentId !== ROOT_FEATURE) {
          state.active = parentId;
        }
      } else {
        const list = computeFeaturesDisplayList(parentIdOf(prev), features);
        const prevIdx = list.findIndex((f) => f.id === prevId);
        let nextIdx = payload === 'up' ? prevIdx - 1 : prevIdx + 1;
        if (nextIdx > list.length - 1) nextIdx = 0;
        const next = list.at(nextIdx);
        if (next) state.active = next.id;
      }
    },

    enterLatlngPicker(state, { payload }: PayloadAction<{ type: string }>) {
      const features = state.sync.features;
      const beforeId = state.active;
      const at = computeAtAfter(features, beforeId);
      state.creating = {
        type: payload.type,
        at,
      };
    },
    createGroup(state, { payload }: PayloadAction<{ id: string }>) {
      const features = state.sync.features;
      const beforeId = state.active;
      const at = computeAtAfter(features, beforeId);
      const { id } = payload;
      features[id] = castDraft({
        type: 'group',
        id,
        at,
      });
      state.active = id;
    },
    create(state, { payload }: PayloadAction<Feature>) {
      const features = state.sync.features;
      features[payload.id] = payload;
      state.active = payload.id;
      state.creating = undefined;
    },
    cancelCreating(state, _action: PayloadAction<undefined>) {
      state.creating = undefined;
    },

    updateFeature(
      state,
      { payload }: PayloadAction<{ id: string; update: Partial<Feature> }>,
    ) {
      const feature = state.sync.features[payload.id];
      if (!feature) throw new Error('updateFeature: not found');
      for (const prop in payload.update) {
        feature[prop] = payload.update[prop];
      }
    },
    deleteFeature(state, { payload }: PayloadAction<Feature>) {
      const data = state.sync;

      const { id } = payload;
      const parentId = parentIdOf(payload);

      const sibList = computeFeaturesDisplayList(parentId, data.features);
      const deletedDisplayIdx = sibList.findIndex((f) => f.id === id);
      if (deletedDisplayIdx > -1) {
        const nextActive =
          sibList.at(deletedDisplayIdx + 1) ||
          sibList.at(deletedDisplayIdx - 1);
        state.active = nextActive?.id;
      }

      const { features, trash } = deleteFeatures(
        data.features,
        data.featureTrash,
        payload,
      );
      data.features = features;
      data.featureTrash = trash;
    },
  },
});

export default slice.reducer;
const actions = slice.actions;

export const {
  sync,
  create,
  setActive,
  moveActive,
  enterLatlngPicker,
  cancelCreating,
  updateFeature,
  deleteFeature,
} = actions;

export const createGroup = createAction('features/createGroup', () => ({
  payload: { id: uuid() },
}));

export const selectCreating = (state: RootState) => state.features.creating;

export const selectFeatures = (state: RootState) =>
  state.features.sync.features;

export const selectActiveFeature = (state: RootState): ActiveFeature => {
  const map = selectFeatures(state);
  const id = state.features.active;
  if (!id) return;
  const feature = map[id];
  if (!feature) return;

  if (!['group', 'route', 'point'].includes(feature.type)) {
    console.warn('Unexpected active feature', feature);
    return;
  }

  return feature as any;
};

export const selectIsActiveFeature = (id: string) => (state: RootState) =>
  id && state.features.active === id;

export const selectPeersActiveOnFeature = (id: string) =>
  createSelector([selectPeers], (peers) =>
    Object.values(peers).filter((peer) => peer.activeFeature === id),
  );

export const selectFeaturesList = (parentId: string) =>
  createSelector([selectFeatures], (features) =>
    computeFeaturesList(parentId, features),
  );

export const selectFeaturesDisplayList = (parentId: string) =>
  createSelector([selectFeatures], (features) =>
    computeFeaturesDisplayList(parentId, features),
  );

export const selectFirstTopLevelFeature = createSelector(
  [selectFeaturesDisplayList(ROOT_FEATURE)],
  (list) => list.at(0),
);

export const selectLastTopLevelFeature = createSelector(
  [selectFeaturesDisplayList(ROOT_FEATURE)],
  (list) => list.at(-1),
);

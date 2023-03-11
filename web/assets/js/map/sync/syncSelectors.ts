// import { createSelector } from '@reduxjs/toolkit';
// import { RootState } from '../store/type';
// import { Aware, SyncData } from './types';
// import { selectIs3d, selectLayers } from '../layers/slice';
// import {
//   selectActiveFeature,
//   selectFeatures,
//   selectFeatureTrash,
// } from '../features/slice';
// import { selectInitialViewAt, selectViewAt } from '../mapSlice';

// export const selectSyncData: (state: RootState) => SyncData = createSelector(
//   [selectLayers, selectIs3d, selectFeatures, selectFeatureTrash],
//   (layers, is3d, features, featureTrash) => ({
//     layers,
//     is3d,
//     features,
//     featureTrash,
//   }),
// );

// export const selectSyncLocalAware: (state: RootState) => Aware = createSelector(
//   [(s) => s.sync.user, selectActiveFeature, selectViewAt, selectInitialViewAt],
//   (user, activeFeature, viewAt) => ({
//     user: user ?? undefined,
//     viewAt,
//     activeFeature: activeFeature?.id,
//   }),
// );

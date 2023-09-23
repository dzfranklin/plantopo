export type SyncGeometry = PointSyncGeometry | LineStringSyncGeometry;
export type PointSyncGeometry = {
  type: 'Point';
  coordinates: [number, number];
};
export type LineStringSyncGeometry = {
  type: 'LineString';
  coordinates: [number, number][];
};

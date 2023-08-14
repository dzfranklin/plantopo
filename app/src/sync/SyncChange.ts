export interface SyncChange {
  featureProps: Array<[number, string, unknown]>;
  layerProps: Array<[number, string, unknown]>;
  deletedFeatures: Array<number>;
}

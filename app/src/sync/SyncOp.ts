export type SyncOp =
  | {
      action: 'createFeature';
      id: number;
      pos: { parent: number; idx: string };
      type: string;
    }
  | { action: 'deleteFeature'; id: number }
  | { action: 'featureSet'; id: number; key: string; value: unknown }
  | { action: 'layerSet'; id: number; key: string; value: unknown };

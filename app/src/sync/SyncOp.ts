export type SyncOp =
  | {
      action: 'fCreate';
      fid: number;
      pos: { parent: number; idx: string };
    }
  | { action: 'fDelete'; fid: number }
  | { action: 'fSet'; fid: number; key: string; value: unknown }
  | { action: 'lSet'; lid: number; key: string; value: unknown };

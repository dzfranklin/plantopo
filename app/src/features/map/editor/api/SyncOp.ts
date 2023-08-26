import { FPos } from './FPos';

// The cannonical version is in sync_server/src/op.rs

export type SyncOp =
  | {
      action: 'fCreate';
      fid: number;
      props: {
        pos: FPos;
        [key: string]: unknown;
      };
    }
  | { action: 'fDelete'; fids: number[] }
  | { action: 'fDeleteConverge'; fids: number[] }
  | { action: 'fSet'; fid: number; key: string; value: unknown }
  | { action: 'lSet'; lid: number; key: string; value: unknown };

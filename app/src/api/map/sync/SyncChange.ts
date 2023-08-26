// Cannonical version in sync_engine/src/change.rs

export interface SyncChange {
  fprops: Array<[number, string, unknown]>;
  lprops: Array<[number, string, unknown]>;
  fdeletes: Array<number>;
}

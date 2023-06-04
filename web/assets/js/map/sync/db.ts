const db = new Dexie('pending-sync');
import Dexie from 'dexie';

db.version(1).stores({
  pending: 'ts,map,[ts+map]',
});
const table = db.table<PendingEntry, string>('pending');

export interface PendingEntry {
  ts: string; // Primary key
  map: string;
  sync: ArrayBuffer;
}

export const loadDb = async (map: string): Promise<PendingEntry[]> =>
  await table.where({ map }).toArray();

// NOTE: It's possible for removeDbEntry to be called before addDbEntry
// completes. This merely results in a redundant sync on the next page load.

export const removeDbEntry = async (map: string, ts: string): Promise<void> => {
  const count = await table.where({ map, ts }).delete();
  if (count !== 1) {
    console.warn('Expected to remove 1 entry', { map, ts, count });
  }
};

export const addDbEntry = async (entry: PendingEntry): Promise<void> => {
  await table.add(entry);
};

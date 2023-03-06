import Dexie from 'dexie';

const ENDPOINT = '/api/report_tile_loads';
const MIN_DELAY_MS = 1000 * 30;
const DELAY_VARIANCE_MS = 1000 * 30;
const CHUNK_SIZE = 5000;
const MIN_SUBSEQUENT_UPLOAD_SIZE = 500;

const db = new Dexie('layer-data-request');
db.version(1).stores({
  requests: '++id',
});
const table = db.table('requests');

let countSinceUpload = 0;
let inUpload = false;

export default function reportTileLoad(
  source: string,
  x: number,
  y: number,
  z: number,
) {
  requestIdleCallback(() => {
    table.add({
      at: Date.now(),
      source,
      x,
      y,
      z,
    });

    countSinceUpload += 1;
    if (!inUpload && countSinceUpload >= MIN_SUBSEQUENT_UPLOAD_SIZE) {
      inUpload = true;
      maybeUpload(MIN_SUBSEQUENT_UPLOAD_SIZE);
    }
  });
}

function maybeUpload(minChunkSize: number) {
  requestIdleCallback(async () => {
    navigator.locks.request('reportTileLoad upload', (_lock) =>
      _maybeUploadInner(minChunkSize),
    );
  });
}

setTimeout(
  () => maybeUpload(1),
  MIN_DELAY_MS + Math.floor(Math.random() * DELAY_VARIANCE_MS),
);

async function _maybeUploadInner(minChunkSize: number) {
  if ((await table.count()) < minChunkSize) {
    return;
  }

  const chunk = await table.orderBy('id').limit(CHUNK_SIZE).toArray();
  let requestFailed = false;

  try {
    const resp = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        user: window.currentUser?.id,
        requests: chunk,
      }),
    });

    if (!resp.ok) {
      console.warn(
        `Failed to report layer data requests [status=${resp.status}]`,
      );
      requestFailed = true;
    }
  } catch (err) {
    console.warn('Failed to report layer data requests', err);
    requestFailed = true;
  }

  if (requestFailed) {
    setTimeout(
      () => maybeUpload(minChunkSize),
      MIN_DELAY_MS + Math.floor(Math.random() * DELAY_VARIANCE_MS),
    );
    return;
  } else {
    console.debug(`Reported ${chunk.length} layer data requests`);
    table.bulkDelete(chunk.map(({ id }) => id));
    countSinceUpload -= chunk.length;
  }

  if (chunk.length === CHUNK_SIZE) {
    requestIdleCallback(() => maybeUpload(minChunkSize));
  } else {
    inUpload = false;
  }
}

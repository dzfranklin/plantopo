import Dexie from 'dexie';

const ENDPOINT = '/api/report_layer_data_requests';
const MIN_INITIAL_DELAY_IF_NO_REQUESTS = 1000 * 30;
const INITIAL_DELAY_VARIANCE_MS = 1000 * 30;
const CHUNK_SIZE = 1000;
const MIN_SUBSEQUENT_UPLOAD_SIZE = 500;

const db = new Dexie('layer-data-request');
db.version(1).stores({
  requests: '++id',
});
const table = db.table('requests');

export default function reportLayerDataRequest(
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

    maybeUpload(MIN_SUBSEQUENT_UPLOAD_SIZE);
  });
}

function maybeUpload(minChunkSize: number) {
  requestIdleCallback(async () => {
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

    if (!requestFailed) {
      console.debug(`Reported ${chunk.length} layer data requests`);
      table.bulkDelete(chunk.map(({ id }) => id));
    }

    if (requestFailed || chunk.length === CHUNK_SIZE) {
      maybeUpload(minChunkSize);
    }
  });
}

setTimeout(
  () => maybeUpload(1),
  MIN_INITIAL_DELAY_IF_NO_REQUESTS +
    Math.floor(Math.random() * INITIAL_DELAY_VARIANCE_MS),
);

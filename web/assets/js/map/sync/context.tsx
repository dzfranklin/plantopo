import { createContext, useContext, useEffect, useState } from 'react';
import { WebsocketProvider } from 'y-websocket';
import * as Y from 'yjs';
import * as decoding from 'lib0/decoding';
import { IndexeddbPersistence } from 'y-indexeddb';
import { ViewAt } from '../ViewAt';
import ComponentChildren from '../components/ComponentChildren';
import { SocketStatus, SyncState } from './types';

const initialState: SyncState = { status: 'disconnected' };

export const SyncContext = createContext<SyncState>(initialState);

const RESYNC_INTERVAL_MS = 1000 * 60 * 5;
const MAX_BACKOFF_MS = 1000 * 30;
export const APPLY_INITIAL_VIEW_AT_TIMEOUT_MS = 1_000;

const INITIAL_VIEW_AT_TAG = 10;

export const MapSyncProvider = ({
  id,
  enableLocalSave,
  children,
}: {
  id: string;
  enableLocalSave: boolean;
  children: ComponentChildren;
}) => {
  const [value, setValue] = useState<SyncState>(initialState);

  useEffect(() => {
    const startMs = Date.now();

    const doc = new Y.Doc({ gc: true });
    window._dbg.sync.yDoc = doc;

    const ws = new WebsocketProvider(wsUrl(), 'sync_socket?' + id, doc, {
      resyncInterval: RESYNC_INTERVAL_MS,
      maxBackoffTime: MAX_BACKOFF_MS,
    });
    window._dbg.sync.ws = ws;
    const aware = ws.awareness;
    ws.on('sync', (isSynced: boolean) => {
      console.debug('ws sync', { isSynced });
    });
    ws.on('status', ({ status }: { status: SocketStatus }) => {
      console.debug('ws status', { status });
      setValue((prev) => ({ ...prev, status }));
    });
    ws.on('connection-close', (event: CloseEvent) => {
      console.debug('ws connection-close', event);
    });
    ws.on('connection-error', (event: CloseEvent) => {
      console.debug('ws connection-error', event);
    });
    ws.messageHandlers[INITIAL_VIEW_AT_TAG] = (_enc, dec, _ws, _es, _ty) => {
      const value = JSON.parse(decoding.readVarString(dec));
      console.debug('got initial view at', value);
      if (Date.now() - startMs < APPLY_INITIAL_VIEW_AT_TIMEOUT_MS) {
        setValue((prev) => ({ ...prev, initialViewAt: value }));
      } else {
        console.warn('Ignoring initial view at as recv too late');
      }
    };

    if (enableLocalSave) {
      const idb = new IndexeddbPersistence(`map/${id}`, doc);
      window._dbg.sync.idb = idb;
      idb.on('synced', () => {
        console.debug('idb synced');
      });
    }

    setValue((prev) => ({ ...prev, aware }));

    return () => {
      ws.destroy();
      doc.destroy();
    };
  }, [id, enableLocalSave]);

  return <SyncContext.Provider value={value}>{children}</SyncContext.Provider>;
};

const wsUrl = () => {
  const server = new URL(location.href);
  server.protocol = location.protocol === 'https:' ? 'wss' : 'ws';
  server.pathname = '';
  server.search = '';
  return server.toString();
};

import { SyncYAwareness, SyncYJson } from '@sanalabs/y-redux';
import { useEffect, useState } from 'react';
import { WebsocketProvider } from 'y-websocket';
import * as Y from 'yjs';
import { useAppDispatch, useAppSelector, useAppStore } from '../hooks';
import { Awareness as YAwareness } from 'y-protocols/awareness';
import { IndexeddbPersistence } from 'y-indexeddb';
import {
  reportAwareUpdate,
  reportSocketStatus,
  reportUpdate,
  selectEnableLocalSave,
  selectSyncData,
  selectSyncLocalAware,
  SocketStatus,
} from './slice';
import { selectId } from '../mapSlice';

const RESYNC_INTERVAL_MS = 1000 * 60 * 5;
const MAX_BACKOFF_MS = 1000 * 30;

export default function MapSync() {
  const dispatch = useAppDispatch();
  const store = useAppStore();
  const id = useAppSelector(selectId);

  const [state, setState] = useState<{
    yAwareness: YAwareness;
    yData: Y.Map<unknown>;
  } | null>(null);

  useEffect(() => {
    const yDoc = new Y.Doc({ gc: true });
    window._dbg.sync.yDoc = yDoc;
    const yData = yDoc.getMap('data') as Y.Map<unknown>;

    const ws = new WebsocketProvider(wsUrl(), 'sync_socket?' + id, yDoc, {
      resyncInterval: RESYNC_INTERVAL_MS,
      maxBackoffTime: MAX_BACKOFF_MS,
    });
    window._dbg.sync.ws = ws;
    const yAwareness = ws.awareness;
    ws.on('sync', (isSynced: boolean) => {
      console.debug('ws sync', { isSynced });
    });
    ws.on('status', ({ status }: { status: SocketStatus }) => {
      console.debug('ws status', { status });
      dispatch(reportSocketStatus(status));
    });
    ws.on('connection-close', (event: CloseEvent) => {
      console.debug('ws connection-close', event);
    });
    ws.on('connection-error', (event: CloseEvent) => {
      console.debug('ws connection-error', event);
    });

    if (selectEnableLocalSave(store.getState())) {
      const idb = new IndexeddbPersistence(`map/${id}`, yDoc);
      window._dbg.sync.idb = idb;
      idb.on('synced', () => {
        console.debug('idb synced');
      });
    }

    setState({ yAwareness, yData });
    return () => {
      ws.destroy();
      yDoc.destroy();
    };
  }, [dispatch, id, store]);

  if (!state) return <></>;
  return (
    <>
      <SyncYJson
        yJson={state.yData}
        selectData={(s) => selectSyncData(s as any) as any}
        setData={reportUpdate}
      />
      <SyncYAwareness
        awareness={state.yAwareness}
        selectLocalAwarenessState={(s) => selectSyncLocalAware(s as any) as any}
        setAwarenessStates={reportAwareUpdate}
      />
    </>
  );
}

const wsUrl = () => {
  const server = new URL(location.href);
  server.protocol = location.protocol === 'https:' ? 'wss' : 'ws';
  server.pathname = '';
  server.search = '';
  return server.toString();
};

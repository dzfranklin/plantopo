import { SyncYAwareness, SyncYJson } from '@sanalabs/y-redux';
import { useEffect, useState } from 'react';
import { WebsocketProvider } from 'y-websocket';
import * as Y from 'yjs';
import { useAppDispatch, useAppSelector } from './hooks';
import { Awareness as YAwareness } from 'y-protocols/awareness';
import {
  remoteSetFeatures,
  remoteSetLayers,
  remoteSetPeerAwareness,
  selectAwareness,
  selectFeatures,
  selectId,
  selectLayers,
  WsStatus,
  wsReportStatus,
} from './mapSlice';
import {
  JsonObject,
  JsonTemplateArray,
  JsonTemplateObject,
} from '@sanalabs/json';

const RESYNC_INTERVAL_MS = 1000 * 60 * 5;
const MAX_BACKOFF_MS = 1000 * 60 * 2;

export default function MapSync() {
  const dispatch = useAppDispatch();
  const id = useAppSelector(selectId);

  const [state, setState] = useState<{
    yAwareness: YAwareness;
    yLayers: Y.Array<unknown>;
    yFeatures: Y.Map<unknown>;
  } | null>(null);

  useEffect(() => {
    const yDoc = new Y.Doc({ gc: true });
    window._dbg.sync.yDoc = yDoc;
    const yLayers = yDoc.getArray('layers') as Y.Array<unknown>;
    const yFeatures = yDoc.getMap('features') as Y.Map<unknown>;

    const ws = new WebsocketProvider(wsUrl(id), 'socket', yDoc, {
      resyncInterval: RESYNC_INTERVAL_MS,
      maxBackoffTime: MAX_BACKOFF_MS,
    });
    window._dbg.sync.ws = ws;
    const yAwareness = ws.awareness;
    ws.on('sync', (isSynced: boolean) => {
      console.debug('ws sync', { isSynced });
    });
    ws.on('status', ({ status }: { status: WsStatus }) => {
      console.debug('ws status', { status });
      dispatch(wsReportStatus(status));
    });
    ws.on('connection-close', (event: CloseEvent) => {
      console.debug('ws connection-close', event);
    });
    ws.on('connection-error', (event: CloseEvent) => {
      console.debug('ws connection-error', event);
    });

    setState({ yAwareness, yLayers, yFeatures });
    return () => {
      ws.destroy();
      yDoc.destroy();
    };
  }, [id]);

  if (!state) return <></>;
  const { yAwareness, yLayers, yFeatures } = state;
  return (
    <>
      <SyncYJson
        yJson={yLayers}
        selectData={(s) => selectLayers(s) as unknown as JsonTemplateArray}
        setData={(d) => remoteSetLayers(d)}
      />
      <SyncYJson
        yJson={yFeatures}
        selectData={(s) => selectFeatures(s) as unknown as JsonTemplateObject}
        setData={remoteSetFeatures}
      />
      <SyncYAwareness
        awareness={yAwareness}
        selectLocalAwarenessState={(s) =>
          selectAwareness(s) as JsonObject | undefined
        }
        setAwarenessStates={remoteSetPeerAwareness}
      />
    </>
  );
}

const wsUrl = (id: string) => {
  const server = new URL(location.href);
  server.protocol = location.protocol === 'https:' ? 'wss' : 'ws';
  server.port = '4005';
  server.pathname = 'map/' + id;
  return server.toString();
};

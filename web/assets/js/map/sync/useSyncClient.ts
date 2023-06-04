// import { useCallback, useEffect, useRef, useState } from 'react';
// import { Client } from './core';
// import { SyncDispatch, SyncState, SyncStatus } from './types';
// import { addDbEntryWhenIdle, loadDb, removeDbEntry } from './db';
// import { ViewAt } from '../ViewAt';

// const MAX_RECONNECT_DELAY_MS = 64 * 1000;

// const ERROR_NAME = {
//   2: 'parseError',
//   3: 'invalidError',
//   4: 'writeForbiddenError',
//   5: 'accessForbiddenError',
//   6: 'serverError',
// };

// const initialState: SyncState = {
//   aware: {
//     my: undefined,
//     peers: {},
//   },
//   attrs: {},
//   layers: [],
//   features: {
//     order: {},
//     value: {},
//   },
// };

// // NOTE: The purpose of instanceId is to make reading the console and network
// // logs easier.
// let nextInstanceId = 0;

// // TODO: The state machine here is a rat's nest. Maybe explicit state charts?
// // Maybe this should be it's own standalone something not managed by the react lifecycle?

// /**
//  * Caller must ensure `initSyncCore` has completed.
//  */
// export const useSyncClient = (
//   mapId: string,
//   { clientId, token }: { clientId: string; token: string },
// ): [SyncStatus, SyncState, SyncDispatch] => {
//   const wsRef = useRef<WebSocket>();
//   const clientRef = useRef<Client>();
//   const pendingRef = useRef<Map<string, ArrayBuffer>>(new Map());
//   const [status, setStatus] = useState<SyncStatus>({ type: 'initializing' });
//   const [state, setState] = useState(initialState);

//   // TODO: We're getting excessive reconnects. Is this related to the freed client problem?

//   useEffect(() => {
//     const instanceId = ++nextInstanceId;
//     let maybeAwareHeartbeat: ReturnType<typeof setInterval> | undefined;
//     let connectRetries = 0;
//     const pending = pendingRef.current;

//     const client = new Client(mapId, BigInt(clientId));
//     clientRef.current = client;

//     // Kick of a load of any syncs still unconfirmed when we exited
//     loadDb(mapId).then((loaded) => {
//       if (isFreed(client)) {
//         // We're in the middle of cleaning up the useEffect
//         return;
//       }
//       for (const [deltaTs, sync] of loaded) {
//         pending.set(deltaTs, sync);
//         // Since we won't necessarily have them echoed back by the server
//         client.recv(new Uint8Array(sync));

//         if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
//           wsRef.current.send(sync);
//         }
//       }
//     });

//     // Initialize state
//     setState(client.state() as SyncState);

//     const url = wsUrl(mapId) + '?_instanceId=' + instanceId;
//     const connect = () => {
//       setStatus({ type: 'connecting' });
//       console.info(`[${instanceId}] Connecting to ${url}`);

//       if (wsRef.current) {
//         wsRef.current.close();
//       }

//       const ws = new WebSocket(url);
//       ws.binaryType = 'arraybuffer';
//       wsRef.current = ws;

//       ws.onopen = () => {
//         connectRetries = 0;

//         if (isFreed(client)) {
//           // We're in the middle of cleaning up the useEffect
//           return;
//         }

//         console.info(`[${instanceId}] Connected`);
//         setStatus({ type: 'connected' });

//         ws.send(client.authMsg(token));

//         ws.send(client.dispatch({ type: 'aware/touch' })['sync']);
//         maybeAwareHeartbeat && clearInterval(maybeAwareHeartbeat);
//         maybeAwareHeartbeat = setInterval(() => {
//           ws.send(client.dispatch({ type: 'aware/touch' })['sync']);
//         }, 15 * 1000);

//         for (const sync of pending.values()) {
//           ws.send(sync);
//         }
//       };

//       ws.onclose = () => {
//         if (ws['noReconnect']) {
//           console.info(`[${instanceId}] Closed, no reconnect`);
//           return;
//         }
//         console.info(`[${instanceId}] Closed, reconnecting`);
//         connectRetries++;
//         const delay = Math.min(
//           Math.pow(2, connectRetries) * 100 + Math.random() * 1000,
//           MAX_RECONNECT_DELAY_MS,
//         );
//         const retryAt = Date.now() + delay;

//         console.info(
//           `[${instanceId}] Reconnecting in ${Math.round(delay / 10) / 100}s`,
//         );

//         setStatus({ type: 'retryWait', retryAt });
//         setTimeout(() => connect(), delay);
//       };

//       ws.onmessage = (event) => {
//         if (isFreed(client)) {
//           // We're in the middle of cleaning up the useEffect
//           return;
//         }

//         if (event.data instanceof ArrayBuffer) {
//           const data = new Uint8Array(event.data);
//           const res = client.recv(data) as any;

//           switch (res.type) {
//             case 'delta': {
//               setState(client.state() as SyncState);
//               break;
//             }
//             case 'confirmDelta': {
//               const deltaTs = res.deltaTs as string;
//               removeDbEntry(mapId, deltaTs);
//               break;
//             }
//             case 'aware': {
//               setState(client.state() as SyncState);
//               break;
//             }
//             case 'error': {
//               let name: string;
//               if (res.code in ERROR_NAME) {
//                 name = `${ERROR_NAME[res.code]} (${res.code})`;
//               } else {
//                 name = res.code.toString();
//               }
//               console.error(
//                 `[${instanceId}] Received ${name}: ${res.description}`,
//               );
//               ws.close();
//               break;
//             }
//             case 'unknown': {
//               console.info(
//                 `[${instanceId}] Ignored unknown message variant: ${res.variant}`,
//               );
//               break;
//             }
//             default: {
//               throw new Error(`Unexpected recv res.type: ${res.type}`);
//             }
//           }
//         } else {
//           console.warn(`[${instanceId}] Unexpected message: ${event.data}`);
//         }
//       };
//     };

//     connect();

//     return () => {
//       if (wsRef.current) {
//         wsRef.current['noReconnect'] = true;
//         wsRef.current.close();
//         wsRef.current = undefined;
//       }

//       client.free();
//       clientRef.current = undefined;

//       maybeAwareHeartbeat && clearInterval(maybeAwareHeartbeat);
//     };
//   }, [mapId, clientId, token]);

//   const dispatch = useCallback(
//     (action: any) => {
//       const client = clientRef.current;
//       if (!client) {
//         console.warn('Dropping dispatch because client unset');
//         return;
//       }

//       const res = client.dispatch(action) as any;

//       setState(client.state() as SyncState);

//       const sync = (res.sync as Uint8Array).buffer;
//       const syncTs = res.syncTs as string;
//       const shouldConfirm = res.shouldConfirm;
//       // Not part of public api
//       delete res.sync;
//       delete res.syncTs;
//       delete res.shouldConfirm;

//       try {
//         wsRef.current?.send(sync);
//       } finally {
//         if (shouldConfirm) {
//           pendingRef.current.set(syncTs, sync);
//           addDbEntryWhenIdle(mapId, syncTs, sync);
//         }
//       }

//       return res;
//     },
//     [mapId],
//   );

//   return [status, state, dispatch];
// };

// const isFreed = (client: Client): boolean => {
//   const ptr = client['ptr'] as number;
//   return ptr === 0;
// };

// const wsUrl = (map_id: string) => {
//   const hostname = location.hostname;

//   let proto: string;
//   let port: string;
//   if (location.protocol == 'https:') {
//     proto = 'wss';
//     port = '4005';
//   } else {
//     proto = 'ws';
//     port = '4004';
//   }

//   return `${proto}://${hostname}:${port}/ws/${map_id}`;
// };

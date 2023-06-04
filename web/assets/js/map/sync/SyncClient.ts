import { CoreClient, initSyncCore } from './core';
import { PendingEntry, addDbEntry, loadDb, removeDbEntry } from './db';
import { SyncState, SyncStatus, SyncToken } from './types';

export class SyncClient {
  // NOTE: There are multiple states that are transitioned in the background.
  //
  // - wasmState: Global state of loading the wasm module
  // - validity: Whether this instance is in a state where anything can work. If
  //   invalid then most method calls will error and callbacks will silently noop.
  // - _socketStatus: Status of the websocket connection.
  // - socketConnectErrors: The number of failed socket connections since the last
  //   successful connection. A connection is considered successful if there are
  //   no errors for CONNECT_SUCCESS_AFTER_MS.

  // Constants

  private static readonly WRITE_FORBIDDEN_ERROR = 4;
  private static readonly ACCESS_FORBIDDEN_ERROR = 5;
  private static readonly RELOAD_ON_ERRORS = [
    // Reload the page when encountering these. This gets us a fresh token.
    this.WRITE_FORBIDDEN_ERROR,
    this.ACCESS_FORBIDDEN_ERROR,
  ];
  private static readonly SYNC_ERROR_NAMES = {
    2: 'parseError',
    3: 'invalidError',
    [this.WRITE_FORBIDDEN_ERROR]: 'writeForbiddenError',
    [this.ACCESS_FORBIDDEN_ERROR]: 'accessForbiddenError',
    6: 'serverError',
  };

  private static readonly RECONNECT_BACKOFF_FACTOR_MS = 0.1 * 1000;
  private static readonly MAX_RECONNECT_DELAY_MS = 64 * 1000;
  private static readonly MAX_RECONNECT_JITTER_MS = 0.5 * 1000;

  // Send aware info to tell the server we still exist this often
  private static readonly HEARTBEAT_INTERVAL_MS = 15 * 1000;
  // A connection is considered successful if there are no errors this long
  private static readonly CONNECT_SUCCESS_AFTER_MS = 30 * 1000;

  // Static properties

  static wasmState:
    | { type: 'idle' }
    | {
        type: 'initializing';
        waiters: [() => void, (err: unknown) => void][]; // [resolve, reject]
      }
    | { type: 'ready' }
    | { type: 'failed'; error: unknown } = { type: 'idle' };

  private static nextDebugId = 0;

  // Instance properties

  // Useful for tracing debug logs with multiple clients
  private debugId: number;

  private token: SyncToken;

  private _socketStatus: SyncStatus = { type: 'connecting' };
  private validity: 'valid' | 'coreInitFailed' | 'destroyed' = 'valid';

  private client: CoreClient | null = null;

  private socket: WebSocket | null = null;
  private socketConnectErrors = 0;
  private connectSuccessTimeout: ReturnType<typeof setTimeout> | null = null;
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null;

  private pendingDispatch: [
    object, // Action
    (res: object) => void, // Resolve cb
    (rej: unknown) => void, // Reject cb
  ][] = [];
  private pendingSend: PendingEntry[] = [];
  private pendingConfirm: Map<string, PendingEntry> = new Map();
  private statusListeners: ((status: SyncStatus) => void)[] = [];
  private stateListeners: ((state: SyncState) => void)[] = [];

  constructor(token: SyncToken) {
    this.debugId = SyncClient.nextDebugId++;
    this.token = token;

    loadDb(token.mapId)
      .then((entries) => this.onLoadPendingDb(entries))
      .catch((err) => {
        this.logError('load pending db failed', err);
      });

    SyncClient.awaitCoreInit()
      .then(() => this.awaitCoreInitDone('success'))
      .catch((err) => this.awaitCoreInitDone('error', err));

    this.logInfo(this);
  }

  mapId(): string {
    return this.token.mapId;
  }

  socketStatus(): SyncStatus {
    return this._socketStatus;
  }

  state(): SyncState {
    this.assertValid();
    if (this.client) {
      return this.client.state() as SyncState;
    } else {
      return {
        aware: {
          myId: this.token.clientId,
          my: {
            user: this.token.userId,
            activeFeature: undefined,
          },
          peers: {},
        },
        attrs: {},
        layers: [],
        features: {
          order: {},
          value: {},
        },
      };
    }
  }

  addStatusListener(listener: (status: SyncStatus) => void) {
    this.statusListeners.push(listener);
  }

  removeStatusListener(listener: (status: SyncStatus) => void) {
    this.statusListeners = this.statusListeners.filter((l) => l !== listener);
  }

  addStateListener(listener: (state: SyncState) => void) {
    this.stateListeners.push(listener);
  }

  removeStateListener(listener: (state: SyncState) => void) {
    this.stateListeners = this.stateListeners.filter((l) => l !== listener);
  }

  async dispatch(action: object): Promise<object> {
    this.assertValid();

    if (!this.client) {
      this.log('Enqueueing for dispatch', action);
      return new Promise((resolve, reject) => {
        this.pendingDispatch.push([action, resolve, reject]);
      });
    }

    this.log('dispatching', action);
    let res: object;
    try {
      res = this.client.dispatch(action);
    } catch (error) {
      // TODO: This will frequently be caused by something like a peer deleting
      // a layer while you try to rename it. Should be handled better.
      this.logWarn('dispatch failed', error);
      throw error;
    }

    this.triggerStateListeners();

    // Pull out the private part of the api
    const sync = (res['sync'] as Uint8Array).buffer;
    delete res['sync'];
    const syncTs = res['syncTs'] as string;
    delete res['syncTs'];
    const shouldConfirm = res['shouldConfirm'] as boolean;
    delete res['shouldConfirm'];

    const entry = {
      map: this.mapId(),
      ts: syncTs,
      sync,
    };

    try {
      this.socket!.send(sync);
      this.log(`Sent sync for dispatch: ${syncTs}`);
      if (shouldConfirm) {
        this.pendingConfirm.set(entry.ts, entry);
      }
    } catch (e) {
      this.logWarn(`Error sending sync, enqueueing: ${syncTs}`, e);
      this.pendingSend.push(entry);
    }

    addDbEntry(entry);

    return res;
  }

  disconnect() {
    this.assertValid();

    this.updateStatus({ type: 'disconnected' });
    this.socket?.close();
  }

  reconnect() {
    this.assertValid();

    this.socketConnectErrors = 0;
    this.updateStatus({ type: 'connecting' });
    this.connectSocket();
  }

  destroy() {
    this.log('destroy');
    this.assertValid();

    this.updateStatus({ type: 'disconnected' });
    if (this.socket && this.socket.readyState != WebSocket.CLOSED) {
      this.socket.close();
    }
    this.client?.free();
    this.validity = 'destroyed';
  }

  private onHeartbeat() {
    if (this.validity !== 'valid') {
      this.heartbeatInterval && clearInterval(this.heartbeatInterval);
      return;
    }

    if (this.client === null) {
      // See the comment on the same check in onSocketOpen
      this.log('onHeartbeat: null client');
      return;
    }

    const awareSync = this.client.dispatch({ type: 'aware/touch' })['sync'];
    try {
      if (this.socket && this.socket.readyState != WebSocket.CLOSED) {
        this.socket.send(awareSync);
        this.log('Sent aware');
      }
    } catch (e) {
      this.socket?.close();
    }
  }

  private awaitCoreInitDone(status: 'success' | 'error', err?: unknown) {
    if (status === 'error') {
      this.logError('Initializing core failed', err);
      this.validity = 'coreInitFailed';
      for (const [_action, _res, rej] of this.pendingDispatch) {
        rej(err);
      }
      return;
    }

    if (this.validity !== 'valid') return;

    this.client = new CoreClient(
      this.token.mapId,
      BigInt(this.token.clientId),
      this.token.userId,
    );
    this.connectSocket();
  }

  private onLoadPendingDb(entries: PendingEntry[]) {
    if (this.validity !== 'valid') return;

    try {
      for (const entry of entries) {
        this.socket!.send(entry.sync);
        this.log(`onLoadPendingDb: Sent pending sync: ${entry.ts}`);
        this.pendingConfirm.set(entry.ts, entry);
      }
    } catch {
      for (const entry of entries) {
        this.pendingSend.push(entry);
      }
      this.socket?.close();
    }
  }

  private onSocketOpen() {
    this.log('Socket connected');
    if (this.validity !== 'valid') return;

    if (this.client === null) {
      // We wait to call connect until we've initialized core and created the
      // client. But a user could call disconnect and then connect before core
      // is initialized.
      //
      // In that rare case just let our error backoff delay us
      this.log('onSocketOpen: null client');
      this.socket!.close();
      return;
    }

    this.updateStatus({ type: 'connected' });
    this.connectSuccessTimeout = setTimeout(() => {
      this.log('connectSuccessTimeout');
      this.socketConnectErrors = 0;
      this.connectSuccessTimeout = null;
    }, SyncClient.CONNECT_SUCCESS_AFTER_MS);

    this.heartbeatInterval = setInterval(
      () => this.onHeartbeat(),
      SyncClient.HEARTBEAT_INTERVAL_MS,
    );

    // Send initial messages
    const authSync = this.client.authMsg(this.token.token);
    const awareSync = this.client.dispatch({ type: 'aware/touch' })['sync'];
    try {
      this.socket!.send(authSync);
      this.socket!.send(awareSync);
      this.log('Sent initial messages');
    } catch (e) {
      this.logWarn('Error sending initial messages on open', e);
      this.socket?.close();
    }

    // Trigger pending dispatches
    for (const [action, res, rej] of this.pendingDispatch) {
      this.dispatch(action).then(res).catch(rej);
    }

    // Try and send all pending
    for (const entry of this.pendingSend) {
      this.socket!.send(entry.sync);
      this.log(`onSocketOpen: Sent pending sync: ${entry.ts}`);
    }

    // If successfully sent all pendingSend move to pendingConfirm
    for (const entry of this.pendingSend) {
      this.pendingConfirm.set(entry.ts, entry);
    }
    this.pendingSend = [];
  }

  private onSocketClose() {
    this.log('onSocketClose');
    this.connectSuccessTimeout && clearTimeout(this.connectSuccessTimeout);
    this.heartbeatInterval && clearInterval(this.heartbeatInterval);

    if (this.validity !== 'valid') return;
    if (this._socketStatus.type === 'disconnected') return;

    this.socketConnectErrors++;
    this.connectSocket();
  }

  private onSocketMessage(event: MessageEvent) {
    if (this.validity !== 'valid') return;
    if (!(event.data instanceof ArrayBuffer)) {
      this.logWarn('Unexpected message', event);
      return;
    }
    if (this.client === null) {
      throw new Error('onSocketMessage: null client. Should be unreachable.');
    }

    const data = new Uint8Array(event.data);
    const res = this.client.recv(data) as any;
    this.log('Received', res);

    switch (res.type) {
      case 'delta': {
        this.triggerStateListeners();
        break;
      }
      case 'confirmDelta': {
        const deltaTs = res.deltaTs as string;
        this.pendingConfirm.delete(deltaTs);
        removeDbEntry(this.mapId(), deltaTs);
        break;
      }
      case 'aware': {
        this.triggerStateListeners();
        break;
      }
      case 'error': {
        const { code, description } = res;
        const name = SyncClient.SYNC_ERROR_NAMES[code] || '<Unknown code>';
        this.logError(`Received error: ${name} (${code}): ${description}`);

        this.socket?.close();

        if (SyncClient.RELOAD_ON_ERRORS.includes(code)) {
          this.logWarn('Reloading');
          window.location.reload();
        }

        break;
      }
      case 'unknown': {
        this.log(`Ignored unknown message variant: ${res.variant}`);
        break;
      }
      default: {
        throw new Error(`Unexpected recv res.type: ${res.type}`);
      }
    }
  }

  private connectSocket() {
    let delay = 0;
    // No delay first 2 attempts
    if (this.socketConnectErrors > 1) {
      delay = Math.min(
        Math.pow(2, this.socketConnectErrors) *
          SyncClient.RECONNECT_BACKOFF_FACTOR_MS +
          Math.random() * SyncClient.MAX_RECONNECT_JITTER_MS,
        SyncClient.MAX_RECONNECT_DELAY_MS,
      );

      const retryAt = Date.now() + delay;
      this.updateStatus({ type: 'connecting', willRetryAt: retryAt });
    } else {
      this.updateStatus({ type: 'connecting' });
    }

    this.log(`Connecting socket in ${Math.round(delay / 10) / 100}s`);
    setTimeout(() => {
      this.updateStatus({ type: 'connecting' });
      this.socket = new WebSocket(this.url());
      this.socket.binaryType = 'arraybuffer';
      this.socket.onopen = () => this.onSocketOpen();
      this.socket.onclose = () => this.onSocketClose();
      this.socket.onmessage = (event) => this.onSocketMessage(event);
    }, delay);
  }

  private triggerStateListeners() {
    const state = this.state();
    this.stateListeners.forEach((listener) => listener(state));
  }

  private updateStatus(value: SyncStatus) {
    this._socketStatus = value;
    this.statusListeners.forEach((listener) => listener(this._socketStatus));
  }

  private url(): string {
    const hostname = location.hostname;

    let proto: string;
    let port: string;
    if (location.protocol == 'https:') {
      proto = 'wss';
      port = '4005';
    } else {
      proto = 'ws';
      port = '4004';
    }

    return `${proto}://${hostname}:${port}/ws/${this.mapId()}`;
  }

  private static awaitCoreInit(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      console.log('SyncClient.awaitCoreInit', this.wasmState);

      switch (this.wasmState.type) {
        case 'idle': {
          this.wasmState = {
            type: 'initializing',
            waiters: [[resolve, reject]],
          };

          initSyncCore()
            .then(() => {
              if (this.wasmState.type !== 'initializing') {
                throw new Error('unreachable: wasmState not initializing');
              }

              this.wasmState.waiters.forEach(([res, _rej]) => res());
              this.wasmState = { type: 'ready' };
            })
            .catch((error) => {
              if (this.wasmState.type !== 'initializing') {
                throw new Error('unreachable: wasmState not initializing');
              }

              this.wasmState.waiters.forEach(([_res, rej]) => rej(error));
              this.wasmState = { type: 'failed', error };
            });
          break;
        }
        case 'initializing': {
          this.wasmState.waiters.push([resolve, reject]);
          break;
        }
        case 'ready': {
          resolve();
          break;
        }
      }
    });
  }

  private assertValid() {
    if (this.validity !== 'valid') {
      throw new Error(`Client called in invalid state: ${this.validity}`);
    }
  }

  private log(...args: unknown[]) {
    console.log(`SyncClient${this.debugId}`, ...args);
  }

  private logInfo(...args: unknown[]) {
    console.info(`SyncClient${this.debugId}`, ...args);
  }

  private logWarn(...args: unknown[]) {
    console.warn(`SyncClient${this.debugId}`, ...args);
  }

  private logError(...args: unknown[]) {
    console.error(`SyncClient${this.debugId}`, ...args);
  }

  async devInspectMessage(label: string, msg: ArrayBuffer) {
    try {
      const resp = await fetch('http://localhost:4000/dev/sync-inspector', {
        method: 'post',
        body: msg,
      });
      if (resp.status !== 200) {
        const error = await resp.text();
        this.logWarn('devInspectMessage', label, error);
      } else {
        const value = await resp.json();
        this.log('inspect (out of order)', label, value);
      }
    } catch (error) {
      this.logWarn('devInspectMessage', label, error);
    }
  }
}

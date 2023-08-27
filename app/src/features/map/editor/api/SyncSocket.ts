import { handleResp } from '@/api/support';
import { MapSyncAuthorization } from './MapSyncAuthorization';
import { SyncEngine } from './SyncEngine';
import { SyncOp } from './SyncOp';
import { IncomingMsg, OutgoingMsg } from './socketMessages';

export type SyncSocketState =
  | { status: 'opening' }
  | { status: 'openError'; error: Error }
  | {
      status: 'connected';
      engine: SyncEngine;
    }
  | {
      status: 'disconnected';
      error: Error;
      failures: number;
      nextReconnect: number;
      engine: SyncEngine;
    }
  | {
      status: 'reconnecting';
      error: Error;
      failures: number;
      engine: SyncEngine;
    }
  | { status: 'closed' };

type StateImpl =
  | {
      status: 'opening';
      _step: 'authz';
      _at: number;
    }
  | {
      status: 'opening';
      _step: 'awaitOpen';
      _at: number;
      _remainingAttempts: number;
      _authz: MapSyncAuthorization;
      _ws: WebSocket;
    }
  | {
      status: 'opening';
      _step: 'awaitAccept';
      _at: number;
      _remainingAttempts: number;
      _authz: MapSyncAuthorization;
      _ws: WebSocket;
    }
  | { status: 'openError'; _step: null; _at: number; error: Error }
  | {
      status: 'connected';
      _step: null;
      _at: number;
      engine: SyncEngine;
      _sessionId: number; // server assigned session id, for debugging
      _authz: MapSyncAuthorization;
      _ws: WebSocket;
    }
  | {
      status: 'disconnected';
      _step: null;
      _at: number;
      error: Error;
      failures: number;
      nextReconnect: number;
      engine: SyncEngine;
      _authz: MapSyncAuthorization;
    }
  | {
      status: 'reconnecting';
      _step: 'awaitOpen';
      _at: number;
      error: Error;
      failures: number;
      engine: SyncEngine;
      _authz: MapSyncAuthorization;
      _ws: WebSocket;
    }
  | {
      status: 'reconnecting';
      _step: 'awaitAccept';
      _at: number;
      error: Error;
      failures: number;
      engine: SyncEngine;
      _authz: MapSyncAuthorization;
      _ws: WebSocket;
    }
  | {
      status: 'closed';
      _at: number;
      _step: null;
    };

const MAX_OPEN_STEP_TRIES = 4;

export class SyncSocket {
  private static readonly _KEEPALIVE_INTERVAL_MS = 15_000;

  private _pending: Map<number, SyncOp[]> = new Map();
  private _seq = 0;

  private _state: StateImpl = {
    status: 'opening',
    _step: 'authz',
    _at: Date.now(),
  };
  private _statusLog: Array<[StateImpl['status'], StateImpl['_step'], number]> =
    [];
  private _stateListeners = new Set<(_: SyncSocketState) => any>();

  constructor(readonly mapId: number) {
    fetchAuthz(mapId)
      .then((authz) => {
        const state = this._state;
        if (state.status === 'opening' && state._step === 'authz') {
          this._setState({
            status: 'opening',
            _step: 'awaitOpen',
            _at: Date.now(),
            _remainingAttempts: MAX_OPEN_STEP_TRIES,
            _authz: authz,
            _ws: this._setupWs(authz.url),
          });
        } else if (state.status === 'closed') {
          return;
        } else {
          throw new Error(`Unexpected state: ${state.status}, ${state._step}`);
        }
      })
      .catch((error) => {
        const state = this._state;
        if (state.status === 'opening' && state._step === 'authz') {
          this._setState({
            status: 'openError',
            _step: null,
            _at: Date.now(),
            error,
          });
        } else if (state.status === 'closed') {
          return;
        } else {
          throw new Error(`Unexpected state: ${state.status}, ${state._step}`);
        }
      });
  }

  close(): void {
    const status = this._state;
    if (status.status === 'connected') {
      status._ws.close();
    }
    this._stateListeners.clear();
    this._statusLog = [];
    this._setState({ status: 'closed', _at: Date.now(), _step: null });
  }

  state(): SyncSocketState {
    return this._state;
  }

  logState(): void {
    const origin = this._statusLog[0]?.[2] ?? 0;
    console.table(
      this._statusLog.map(([status, step, at]) => ({
        status,
        step,
        at: `${(at - origin) / 1000}s`,
      })),
    );
  }

  addStateListener(l: (_: SyncSocketState) => any): () => void {
    this._stateListeners.add(l);
    return () => this._stateListeners.delete(l);
  }

  private _setState(value: StateImpl) {
    console.log('SyncSocket: state =', value, this);
    this._state = value;
    this._statusLog.push([value.status, value._step, value._at]);
    for (const l of this._stateListeners) l(value);
  }

  private _setupWs(url: string): WebSocket {
    const ws = new WebSocket(url);
    ws.onopen = (evt) => this._onWsOpen(evt);
    ws.onclose = (evt) => this._onWsClose(evt);
    ws.onmessage = (evt) => this._onWsMessage(evt);
    return ws;
  }

  private _onWsOpen(_evt: Event): void {
    const state = this._state;
    if (state.status === 'closed') return;
    if (state.status === 'opening' && state._step === 'awaitOpen') {
      state._ws.send(JSON.stringify({ token: state._authz.token }));
      this._setState({
        status: 'opening',
        _step: 'awaitAccept',
        _at: Date.now(),
        _remainingAttempts: state._remainingAttempts,
        _authz: state._authz,
        _ws: state._ws,
      });
      this._resetKeepalive();
    } else if (state.status === 'reconnecting' && state._step === 'awaitOpen') {
      state._ws.send(JSON.stringify({ token: state._authz.token }));
      this._setState({
        status: 'reconnecting',
        _at: Date.now(),
        _step: 'awaitAccept',
        error: state.error,
        failures: state.failures,
        engine: state.engine,
        _authz: state._authz,
        _ws: state._ws,
      });
      this._resetKeepalive();
    }
  }

  private _onWsClose(evt: CloseEvent): void {
    this._stopKeepalive();

    const error = new Error(`Socket closed unexpectedly: ${evt.reason}`);
    const state = this._state;
    if (state.status === 'opening') {
      if (state._step === 'authz') {
        throw new Error('Unreachable state');
      } else {
        const remainingAttempts = state._remainingAttempts - 1;
        if (remainingAttempts > 0) {
          const authz = state._authz;
          const ws = this._setupWs(authz.url);
          this._setState({
            status: 'opening',
            _step: 'awaitOpen',
            _at: Date.now(),
            _remainingAttempts: remainingAttempts,
            _authz: authz,
            _ws: ws,
          });
        } else {
          this._setState({
            status: 'openError',
            _at: Date.now(),
            _step: null,
            error: error,
          });
        }
      }
    } else if (state.status === 'connected') {
      const authz = state._authz;
      const ws = this._setupWs(authz.url);
      this._setState({
        status: 'reconnecting',
        _step: 'awaitOpen',
        _at: Date.now(),
        error: error,
        failures: 1,
        engine: state.engine,
        _authz: authz,
        _ws: ws,
      });
    } else if (state.status === 'reconnecting') {
      const failures = state.failures + 1;
      const delay = reconnectDelayFor(failures);
      this._setState({
        status: 'disconnected',
        _step: null,
        _at: Date.now(),
        error: error,
        failures,
        nextReconnect: Date.now() + delay,
        engine: state.engine,
        _authz: state._authz,
      });
      setTimeout(() => this._onAfterReconnectDelay(), delay);
    } else if (state.status === 'disconnected') {
      throw new Error('Unreachable state');
    } else if (state.status === 'openError') {
      throw new Error('Unreachable state');
    } else if (state.status === 'closed') {
      return;
    }
  }

  private _onAfterReconnectDelay(): void {
    const state = this._state;
    if (state.status === 'disconnected') {
      const ws = this._setupWs(state._authz.url);
      this._setState({
        status: 'reconnecting',
        _step: 'awaitOpen',
        _at: Date.now(),
        error: state.error,
        failures: state.failures,
        engine: state.engine,
        _authz: state._authz,
        _ws: ws,
      });
    } else if (state.status === 'closed') {
      return;
    } else {
      throw new Error(`Unreachable state: ${state.status}`);
    }
  }

  private _onWsMessage(evt: MessageEvent): void {
    if (typeof evt.data !== 'string') {
      console.info('Ignoring non-text message');
      return;
    }

    const state = this._state;
    const msg: IncomingMsg = JSON.parse(evt.data);

    if (
      (state.status === 'opening' && state._step === 'awaitAccept') ||
      state.status === 'reconnecting'
    ) {
      if (msg.type === 'connectAccept') {
        const { fidBlockStart, fidBlockUntil } = msg;
        const { canEdit } = state._authz;
        const engine = new SyncEngine({
          fidBlockStart,
          fidBlockUntil,
          canEdit,
          send: canEdit ? this._enqueueOps.bind(this) : null,
        });

        this._setState({
          status: 'connected',
          _step: null,
          _at: Date.now(),
          engine,
          _authz: state._authz,
          _ws: state._ws,
          _sessionId: msg.sessionId,
        });

        if (state._authz.canEdit) {
          engine.startTransaction();
          engine.receive(msg.state);
          for (const ops of this._pending.values()) {
            // Note that while apply can mutate its arguments we don't mind
            // getting fixes here
            engine.apply(ops);
          }
          engine.commitTransaction();

          for (const [seq, ops] of this._pending.entries()) {
            state._ws.send(JSON.stringify({ type: 'op', seq, ops }));
          }
        } else if (this._pending.size > 0) {
          console.warn('!canEdit but pending ops');
        }
      } else {
        throw new Error(`Received unexpected message (type is ${msg.type})`);
      }
    } else if (state.status === 'connected') {
      if (msg.type === 'connectAccept') {
        throw new Error('Received connectAccept but already connected');
      } else if (msg.type === 'reply') {
        if (!this._pending.delete(msg.replyTo)) {
          console.info('recv unexpected reply', msg);
        }
        state.engine.receive(msg.change);
      } else if (msg.type === 'bcast') {
        state.engine.receive(msg.change);
      } else if (msg.type === 'error') {
        console.error('Received error', msg.error, msg.details);
      } else {
        console.info('Received unexpected message', msg);
      }
    } else {
      throw new Error(`Unreachable state: ${state.status}`);
    }
  }

  private _keepalive: number | undefined;
  private _resetKeepalive(): void {
    if (this._keepalive !== undefined) {
      window.clearTimeout(this._keepalive);
    }
    this._keepalive = window.setTimeout(() => {
      this._maybeSend({ type: 'keepalive' });
      this._keepalive = undefined;
      this._resetKeepalive();
    }, SyncSocket._KEEPALIVE_INTERVAL_MS);
  }

  private _stopKeepalive(): void {
    if (this._keepalive !== undefined) {
      window.clearTimeout(this._keepalive);
      this._keepalive = undefined;
    }
  }

  private _enqueueOps(ops: SyncOp[]): void {
    const seq = ++this._seq;
    this._pending.set(seq, ops);
    this._maybeSend({ type: 'op', seq, ops });
  }

  private _maybeSend(msg: OutgoingMsg): boolean {
    if (this._state.status === 'connected') {
      this._state._ws.send(JSON.stringify(msg));
      return true;
    } else {
      return false;
    }
  }
}

async function fetchAuthz(id: number): Promise<MapSyncAuthorization> {
  let tries = 0;
  for (;;) {
    try {
      tries++;
      return await handleResp(
        fetch(`/api/map/authorize_sync?id=${id}`, {
          method: 'POST',
        }),
      );
    } catch (err) {
      console.warn(err);
      if (tries === MAX_OPEN_STEP_TRIES) {
        throw err;
      }
    }
  }
}

/** in ms */
function reconnectDelayFor(failures: number): number {
  return Math.min(failures * 500, 4 * 60 * 1_000);
}

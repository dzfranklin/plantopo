import { API_ENDPOINT_WS } from '@/api/endpoint';
import { IncomingSessionMsg, OutgoingSessionMsg } from './sessionMsg';
import wrapError from '@/generic/wrapError';

export type SyncTransportStatus =
  | { type: 'connecting' }
  | { type: 'connected'; initialLoadComplete: boolean; disconnect: () => void }
  | { type: 'disconnected'; reconnectingAt: number; reconnectNow: () => void };

export const INITIAL_SYNC_TRANSPORT_STATUS: SyncTransportStatus = {
  type: 'connecting',
};

const HEALTHCHECK_INTERVAL = 1000 * 15;
const HEALTHY_MIN_CONNECTED_DURATION = 1000 * 60 * 5;

export class SyncTransport {
  public readonly mapId: string;
  public readonly clientId: string;

  private _endpoint: string;
  private _destroyed = false;
  private _sock: WebSocket | null = null;
  private _failures = 0;
  private _initialLoadComplete = false;
  private _status: SyncTransportStatus = INITIAL_SYNC_TRANSPORT_STATUS;

  private _started = performance.now();
  private _receivesSinceLastHealthcheck = 0;
  private _healthCheckInterval: number;

  private _onMessageListeners = new Set<(msg: IncomingSessionMsg) => any>();
  private _onStatusListeners = new Set<(status: SyncTransportStatus) => any>();

  constructor(props: { mapId: string; clientId: string; endpoint?: string }) {
    this.mapId = props.mapId;
    this.clientId = props.clientId;
    this._endpoint = props.endpoint ?? API_ENDPOINT_WS;
    this._healthCheckInterval = window.setInterval(() => {
      if (this._sock === null) return;
      if (
        this._status.type === 'connected' &&
        this._receivesSinceLastHealthcheck === 0
      ) {
        console.warn(
          'SyncTransport: no messages received since last healthcheck',
        );
        this._advanceState('disconnected');
        this._sock.close();
        return;
      }
      this._receivesSinceLastHealthcheck = 0;
    }, HEALTHCHECK_INTERVAL);
    this._open();
  }

  destroy() {
    this._destroyed = true;
    this._sock?.close();
    window.clearInterval(this._healthCheckInterval);
  }

  get status(): SyncTransportStatus {
    return this._status;
  }

  disconnect() {
    this._sock?.close();
  }

  addOnMessageListener(listener: (msg: IncomingSessionMsg) => any): () => void {
    this._onMessageListeners.add(listener);
    return () => this._onMessageListeners.delete(listener);
  }

  addOnStatusListener(
    listener: (status: SyncTransportStatus) => any,
  ): () => void {
    this._onStatusListeners.add(listener);
    return () => this._onStatusListeners.delete(listener);
  }

  send(msg: OutgoingSessionMsg): Error | null {
    if (this._sock === null) {
      return new Error('not connected');
    }
    if (this._sock.readyState !== WebSocket.OPEN) {
      return new Error('not connected');
    }
    try {
      this._sock.send(JSON.stringify(msg));
    } catch (err) {
      return wrapError(err, 'failed to send message');
    }
    return null;
  }

  private _reconnectDelay(): number {
    return Math.min(1000 * 2 ** (this._failures - 1), 1000 * 60);
  }

  private _open() {
    if (this._sock !== null || this._destroyed) {
      return;
    }
    const endpoint = `${this._endpoint}map/${this.mapId}/sync-socket?clientId=${this.clientId}`;
    console.log('Connecting to', endpoint);
    const sock = new WebSocket(endpoint);
    this._sock = sock;
    this._sock.onopen = () => {
      this._advanceState('connected');

      setTimeout(() => {
        if (this._sock === sock && this.status.type === 'connected') {
          if (this._failures > 0) {
            console.log('SyncTransport: marking previously failed as healthy');
            this._failures = 0;
          }
        }
      }, HEALTHY_MIN_CONNECTED_DURATION);
    };
    this._sock.onmessage = (ev) => {
      const msg = JSON.parse(ev.data) as IncomingSessionMsg;
      if (msg.error) {
        console.warn(`SyncTransport: received error: ${msg.error}`);
      }

      if (msg.initialLoadComplete) {
        this._advanceState('loadComplete');
      }

      this._receivesSinceLastHealthcheck++;
      for (const listener of this._onMessageListeners) {
        listener(msg);
      }
    };
    this._sock.onclose = (ev) => {
      if (ev.code === 1000 || ev.code == 1001) {
        console.log(
          `SyncTransport: sock closed normally: ${ev.code} ${ev.reason}`,
        );
      } else {
        console.warn(
          `SyncTransport: sock closed abnormally: ${ev.code} ${ev.reason}`,
        );
      }
      this._sock = null;
      this._failures++;
      this._advanceState('disconnected');
    };
  }

  private _openTimeout: number | null = null;

  private _advanceState(
    ev: 'connecting' | 'connected' | 'loadComplete' | 'disconnected',
  ) {
    let status: SyncTransportStatus;
    switch (ev) {
      case 'connecting':
        if (this._openTimeout !== null) {
          window.clearTimeout(this._openTimeout);
          this._openTimeout = null;
        }
        status = { type: 'connecting' };
        break;
      case 'connected':
        if (this._openTimeout !== null) {
          window.clearTimeout(this._openTimeout);
          this._openTimeout = null;
        }
        status = {
          type: 'connected',
          initialLoadComplete: this._initialLoadComplete,
          disconnect: () => this.disconnect(),
        };
        break;
      case 'loadComplete':
        if (!this._initialLoadComplete) {
          this._initialLoadComplete = true;

          console.log(
            'initial load took',
            performance.now() - this._started,
            'ms',
          );
        }
        status = {
          type: 'connected',
          initialLoadComplete: this._initialLoadComplete,
          disconnect: () => this.disconnect(),
        };
        break;
      case 'disconnected':
        if (this._status.type === 'disconnected') {
          return;
        }
        const delay = this._reconnectDelay();
        status = {
          type: 'disconnected',
          reconnectingAt: Date.now() + delay,
          reconnectNow: () => this._open(),
        };
        console.log('delaying', delay / 1000, 'seconds');
        this._openTimeout = window.setTimeout(() => this._open(), delay);
        break;
    }
    this._status = status;
    console.log(status);
    for (const listener of this._onStatusListeners) {
      listener(status);
    }
  }
}

import { API_ENDPOINT_WS } from '@/api/endpoint';
import { IncomingSessionMsg, OutgoingSessionMsg } from './sessionMsg';
import wrapError from '@/generic/wrapError';

export type SyncTransportStatus =
  | { type: 'connecting' }
  | { type: 'connected' }
  | { type: 'disconnected'; reconnectingAt: number; reconnectNow: () => void };

const HEALTHCHECK_INTERVAL = 1000 * 30;

export class SyncTransport {
  public readonly mapId: string;
  public readonly clientId: string;

  private _destroyed = false;
  private _sock: WebSocket | null = null;
  private _failures = 0;
  private _status: SyncTransportStatus = { type: 'connecting' };

  private _receivesSinceLastHealthcheck = 0;
  private _healthCheckInterval: number | null = null;

  onMessage: (msg: IncomingSessionMsg) => any = () => {};
  onStatus: (status: SyncTransportStatus) => any = () => {};

  constructor(props: { mapId: string; clientId: string }) {
    this.mapId = props.mapId;
    this.clientId = props.clientId;
    this._healthCheckInterval = window.setInterval(() => {
      if (this._sock === null) return;
      if (this._receivesSinceLastHealthcheck === 0) {
        console.warn(
          'SyncTransport: no messages received since last healthcheck',
        );
        this._sock.close();
        return;
      }
    }, HEALTHCHECK_INTERVAL);
    this._open();
  }

  destroy() {
    this._destroyed = true;
    this._sock?.close();
  }

  get status(): SyncTransportStatus {
    return this._status;
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
    const endpoint = `${API_ENDPOINT_WS}map/${this.mapId}/sync-socket?clientId=${this.clientId}`;
    console.log('Connecting to', endpoint);
    this._sock = new WebSocket(endpoint);
    this._sock.onopen = () => {
      this._advanceState('connected');
    };
    this._sock.onmessage = (ev) => {
      const msg = JSON.parse(ev.data) as IncomingSessionMsg;
      if (msg.error) {
        console.warn(`SyncTransport: received error: ${msg.error}`);
      }
      this._receivesSinceLastHealthcheck++;
      this.onMessage(msg);
    };
    this._sock.onclose = (ev) => {
      if (ev.code === 1000) {
        console.log(`SyncTransport: sock closed normally: ${ev.reason}`);
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

  private _advanceState(type: SyncTransportStatus['type']) {
    let status: SyncTransportStatus;
    switch (type) {
      case 'connecting':
        status = { type: 'connecting' };
        break;
      case 'connected':
        status = { type: 'connected' };
        break;
      case 'disconnected':
        const delay = this._reconnectDelay();
        status = {
          type: 'disconnected',
          reconnectingAt: Date.now() + delay,
          reconnectNow: () => this._open(),
        };
        console.log('delaying', delay / 1000, 'seconds');
        setTimeout(() => this._open(), delay);
        break;
    }
    this._status = status;
    console.log(status);
    this.onStatus(status);
  }
}

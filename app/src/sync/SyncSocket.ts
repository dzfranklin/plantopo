import { SyncEngine } from './SyncEngine';
import { SyncOp } from './SyncOp';
import {
  BcastMsg,
  ConnectAcceptMsg,
  ErrorMsg,
  IncomingMsg,
  OutgoingMsg,
  ReplyMsg,
} from './socketMessages';

export class SyncSocket {
  public readonly mapId: number;

  private static readonly _KEEPALIVE_INTERVAL_MS = 15_000;

  private _connectStart: number | undefined; // unix timestamp, for debugging
  private _sessionId: number | undefined; // server assigned session id, for debugging

  private _onConnect: (_: SyncEngine) => void;
  private _onError: (_: Error) => void;
  private _domain: string;
  private _secure: boolean;
  private _engine: SyncEngine | undefined;
  private _socket: WebSocket | undefined;
  private _pending: Map<number, SyncOp[]> = new Map();
  private _seq = 0;
  private _closing = false;
  private _keepalive: number | undefined;

  constructor(props: {
    mapId: number;
    domain: string;
    secure: boolean;
    onConnect: (_: SyncEngine) => void;
    onError: (_: Error) => void;
  }) {
    this.mapId = props.mapId;
    this._domain = props.domain;
    this._secure = props.secure;
    this._onConnect = props.onConnect;
    this._onError = props.onError;
  }

  connect(): void {
    if (this._socket !== undefined) {
      this._log('Already connected');
      return;
    }

    const base = `${this._secure ? 'wss' : 'ws'}://${this._domain}/`;
    const url = new URL('/api/map_sync', base);
    url.searchParams.set('id', this.mapId.toString());

    this._log('Connecting to', url.toString());
    this._connectStart = Date.now();
    const sock = new WebSocket(url);

    sock.onopen = (evt) => this._onSocketOpen(sock, evt);
    sock.onclose = (evt) => this._onSocketClose(sock, evt);
    sock.onmessage = (evt) => this._onSocketMessage(sock, evt);
    this._socket = sock;
  }

  close(): void {
    if (!this._socket) {
      this._log('Already closed');
      return;
    }
    this._log('Closing socket');
    this._closing = true;
    this._socket.close();
  }

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

  private _maybeSend(msg: OutgoingMsg): boolean {
    if (this._socket?.readyState === WebSocket.OPEN) {
      this._socket.send(JSON.stringify(msg));
      return true;
    } else {
      return false;
    }
  }

  private _onSocketOpen(sock: WebSocket, _evt: Event): void {
    if (this._socket !== sock) return;

    this._log(`socket onopen ${Date.now() - this._connectStart!}ms`);

    // Authenticate
    this._log('Authenticating to socket');
    this._socket!.send(
      JSON.stringify({
        token: 'TODO: ',
      }),
    );

    this._resetKeepalive();
  }

  private _onSocketClose(sock: WebSocket, _evt: CloseEvent): void {
    if (this._socket !== sock) return;
    this._log('Socket closed');
    this._stopKeepalive();
    this._socket = undefined;
    if (this._closing) {
      return;
    }
    this.connect();
  }

  private _onSocketMessage(sock: WebSocket, evt: MessageEvent): void {
    if (this._socket !== sock) return;
    const msg: IncomingMsg = JSON.parse(evt.data);
    this._resetKeepalive();
    this._log('recv', msg);
    switch (msg.type) {
      case 'connectAccept':
        this._onRecvConnectAccept(msg);
        break;
      case 'reply':
        this._onRecvReply(msg);
        break;
      case 'bcast':
        this._onRecvBcast(msg);
        break;
      case 'error':
        this._onRecvError(msg);
        break;
      default:
        this._log('Unknown message type', msg);
        break;
    }
  }

  private _onRecvConnectAccept(msg: ConnectAcceptMsg): void {
    this._log('recv connectAccept', this);
    this._sessionId = msg.sessionId;
    if (this._engine === undefined) {
      this._engine = new SyncEngine({
        fidBlockStart: msg.fidBlockStart,
        fidBlockUntil: msg.fidBlockUntil,
        send: (ops) => {
          const seq = ++this._seq;
          this._pending.set(seq, ops);
          this._log('sending', seq, ops);
          this._maybeSend({ type: 'op', seq, ops });
        },
      });
      this._engine.receive(msg.state);
      this._onConnect(this._engine);
    } else {
      this._log('Reconnect accepted');
      this._engine.receive(msg.state);
    }
    for (const [seq, ops] of this._pending.entries()) {
      this._socket!.send(JSON.stringify({ seq, ops }));
    }
  }

  private _onRecvError(msg: ErrorMsg): void {
    this._onError(new Error(msg.error, { cause: new Error(msg.details) }));
    this.close();
  }

  private _onRecvBcast(msg: BcastMsg): void {
    this._engine!.receive(msg.change);
  }

  private _onRecvReply(msg: ReplyMsg): void {
    if (!this._pending.delete(msg.replyTo)) {
      this._log('recv unexpected reply', msg);
    }
    this._engine!.receive(msg.change);
  }

  private _log(...args: unknown[]): void {
    let ts: string | undefined;
    if (this._connectStart !== undefined) {
      const millis = Date.now() - this._connectStart!;
      ts = `${millis / 1000}s`;
    }
    console.log(
      `[SyncSocket ${this._sessionId || 'preaccept'} at ${ts || 'preconnect'}]`,
      ...args,
    );
  }
}
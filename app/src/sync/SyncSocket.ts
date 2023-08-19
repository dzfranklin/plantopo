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
  private static readonly _SOCKET_URL =
    process.env.NEXT_PUBLIC_MAP_SYNC_SOCKET_URL ||
    (() => {
      throw new Error('Missing NEXT_PUBLIC_MAP_SYNC_SOCKET_URL');
    })();

  private static readonly _KEEPALIVE_INTERVAL_MS = 15_000;

  private _engine: SyncEngine | undefined;
  private _socket: WebSocket | undefined;
  private _pending: Map<number, SyncOp[]> = new Map();
  private _seq = 0;
  private _closing = false;
  private _keepalive: number | undefined;

  constructor(
    public readonly mapId: number,
    public onConnect: (_: SyncEngine) => void,
    public onError: (_: Error) => void,
  ) {}

  connect(): void {
    if (this._socket !== undefined) {
      console.log('Already connected');
      return;
    }

    const url = new URL(SyncSocket._SOCKET_URL);
    url.searchParams.set('id', this.mapId.toString());

    const sock = new WebSocket(url);
    sock.onopen = (evt) => this._onSocketOpen(sock, evt);
    sock.onclose = (evt) => this._onSocketClose(sock, evt);
    sock.onmessage = (evt) => this._onSocketMessage(sock, evt);
    this._socket = sock;
  }

  close(): void {
    if (!this._socket) {
      console.info('Already closed');
      return;
    }
    console.info('Closing socket');
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

    // Authenticate
    console.log('Authenticating to socket');
    this._socket!.send(
      JSON.stringify({
        token: 'TODO: ',
      }),
    );

    this._resetKeepalive();
  }

  private _onSocketClose(sock: WebSocket, _evt: CloseEvent): void {
    if (this._socket !== sock) return;
    console.info('Socket closed');
    this._stopKeepalive();
    this._socket = undefined;
    if (this._closing) {
      return;
    }
    console.info('Reconnecting');
    this.connect();
  }

  private _onSocketMessage(sock: WebSocket, evt: MessageEvent): void {
    if (this._socket !== sock) return;
    const msg: IncomingMsg = JSON.parse(evt.data);
    this._resetKeepalive();
    console.log('recv', msg);
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
        console.info('Unknown message type', msg);
        break;
    }
  }

  private _onRecvConnectAccept(msg: ConnectAcceptMsg): void {
    if (this._engine === undefined) {
      this._engine = new SyncEngine({
        fidBlockStart: msg.fidBlockStart,
        fidBlockUntil: msg.fidBlockUntil,
        send: (ops) => {
          const seq = ++this._seq;
          this._pending.set(seq, ops);
          this._maybeSend({ type: 'op', seq, ops });
        },
      });
      this._engine.receive(msg.state);
      this.onConnect(this._engine);
    } else {
      console.log('Reconnect accepted');
      this._engine.receive(msg.state);
    }
    for (const [seq, ops] of this._pending.entries()) {
      this._socket!.send(JSON.stringify({ seq, ops }));
    }
  }

  private _onRecvError(msg: ErrorMsg): void {
    this.onError(new Error(msg.error, { cause: msg.details }));
    this.close();
  }

  private _onRecvBcast(msg: BcastMsg): void {
    this._engine!.receive(msg.change);
  }

  private _onRecvReply(msg: ReplyMsg): void {
    if (!this._pending.delete(msg.replyTo)) {
      console.info('recv unexpected reply', msg);
    }
    this._engine!.receive(msg.change);
  }
}

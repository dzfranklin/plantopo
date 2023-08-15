import { SyncEngine } from './SyncEngine';
import { SyncOp } from './SyncOp';

export class SyncSocket extends SyncEngine {
  readonly id: number;

  private static readonly _SOCKET_URL =
    process.env.NEXT_PUBLIC_MAP_SYNC_SOCKET_URL ||
    (() => {
      throw new Error('Missing NEXT_PUBLIC_MAP_SYNC_SOCKET_URL');
    })();

  private _socket: WebSocket | undefined;
  private _pending: Map<number, SyncOp> = new Map();
  private _seq = 0;
  private _closing = false;

  constructor(id: number) {
    super();
    this.id = id;
  }

  connect(): void {
    if (this._socket !== undefined) {
      console.log('Already connected');
      return;
    }

    const url = new URL(SyncSocket._SOCKET_URL);
    url.searchParams.set('id', this.id.toString());

    this._socket = new WebSocket(url);

    this._socket.onopen = this.onSocketOpen.bind(this);
    this._socket.onclose = this.onSocketClose.bind(this);
    this._socket.onmessage = this.onSocketMessage.bind(this);
  }

  close(): void {
    if (!this._socket) {
      console.info('Already closed');
      return;
    }
    this._closing = true;
    this._socket.close();
  }

  apply(op: SyncOp): void {
    super.apply(op);

    const seq = ++this._seq;
    this._pending.set(seq, op);
    if (this._socket?.readyState === WebSocket.OPEN) {
      this._socket.send(JSON.stringify({ seq, op }));
    }
  }

  private onSocketOpen(): void {
    // Authenticate
    this._socket!.send(
      JSON.stringify({
        token: 'TODO: ',
      }),
    );

    for (const [seq, op] of this._pending.entries()) {
      this._socket!.send(JSON.stringify({ seq, op }));
    }
  }

  private onSocketClose(_event: CloseEvent): void {
    console.info('Socket closed');
    this._socket = undefined;
    if (this._closing) {
      return;
    }
    // TODO: Persist pending on close?
    console.error('TODO: reconnect');
  }

  private onSocketMessage(event: MessageEvent): void {
    const { reply_to, change } = JSON.parse(event.data);
    if (reply_to !== undefined) {
      this._pending.delete(reply_to);
    }
    super.change(change);
  }
}

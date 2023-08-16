import { SyncEngine } from './SyncEngine';
import { SyncOp } from './SyncOp';
import { RecvMsg } from './socketMessages';

export class SyncSocket extends SyncEngine {
  readonly mapId: number;

  private static readonly _SOCKET_URL =
    process.env.NEXT_PUBLIC_MAP_SYNC_SOCKET_URL ||
    (() => {
      throw new Error('Missing NEXT_PUBLIC_MAP_SYNC_SOCKET_URL');
    })();

  private _onError: (err: Error) => void = logOnError;
  private _socket: WebSocket | undefined;
  private _pending: Map<number, SyncOp[]> = new Map();
  private _seq = 0;
  private _closing = false;

  /** throws if `clientId` is invalid */
  constructor(props: {
    clientId: number;
    mapId: number;
    onError?: (error: Error) => void;
  }) {
    super(props.clientId);
    this.mapId = props.mapId;
    if (props.onError) {
      this._onError = props.onError;
    }
  }

  connect(): void {
    if (this._socket !== undefined) {
      console.log('Already connected');
      return;
    }

    const url = new URL(SyncSocket._SOCKET_URL);
    url.searchParams.set('id', this.clientId.toString());

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

  apply(ops: SyncOp[]): void {
    super.apply(ops);

    const seq = ++this._seq;
    this._pending.set(seq, ops);
    if (this._socket?.readyState === WebSocket.OPEN) {
      this._socket.send(JSON.stringify({ seq, ops }));
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
    const msg: RecvMsg = JSON.parse(event.data);

    if ('error' in msg) {
      this._onError(new Error(msg.error, { cause: msg.details }));
      // TODO: reconnect?
      return;
    }

    if ('replyTo' in msg) {
      super.change(msg.change);
      this._pending.delete(msg.replyTo);
    } else {
      super.change(msg.change);
    }
  }
}

function logOnError(error: Error): void {
  console.error(error);
}

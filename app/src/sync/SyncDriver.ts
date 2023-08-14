import { SyncEngine } from './SyncEngine';
import { SyncObserverManager } from './SyncObserverManager';
import { SyncOp } from './SyncOp';

export class SyncDriver {
  observerManager: SyncObserverManager;

  private static readonly SOCKET_URL =
    process.env.NEXT_PUBLIC_MAP_SYNC_SOCKET_URL ||
    (() => {
      throw new Error('Missing NEXT_PUBLIC_MAP_SYNC_SOCKET_URL');
    })();

  private id: number;
  private socket: WebSocket | undefined;
  private engine: SyncEngine;
  private pending: Map<number, SyncOp> = new Map();
  private seq = 0;
  private closing = false;

  constructor(id: number) {
    this.id = id;
    this.engine = new SyncEngine();
    this.observerManager = this.engine.om;
  }

  connect(): void {
    if (this.socket !== undefined) {
      console.log('Already connected');
      return;
    }

    const url = new URL(SyncDriver.SOCKET_URL);
    url.searchParams.set('id', this.id.toString());

    this.socket = new WebSocket(url);

    this.socket.onopen = this.onSocketOpen.bind(this);
    this.socket.onclose = this.onSocketClose.bind(this);
    this.socket.onmessage = this.onSocketMessage.bind(this);
  }

  moveFeatures(
    features: number[],
    parent: number,
    before: number | undefined,
    after: number | undefined,
  ): void {
    // TODO:
    // have this do the cleaning so we encapsulate the linear shit
    // maybe figure out how to build the datastruct we want in here first
  }

  apply(op: SyncOp): void {
    const seq = ++this.seq;
    this.engine.apply(op);
    this.pending.set(seq, op);
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify({ seq, op }));
    }
  }

  private onSocketOpen(): void {
    // Authenticate
    this.socket!.send(
      JSON.stringify({
        token: 'TODO: ',
      }),
    );

    for (const [seq, op] of this.pending.entries()) {
      this.socket!.send(JSON.stringify({ seq, op }));
    }
  }

  private onSocketClose(_event: CloseEvent): void {
    console.info('Socket closed');
    if (this.closing) {
      return;
    }
    // TODO: Persist pending on close?
    console.error('TODO: reconnect');
  }

  private onSocketMessage(event: MessageEvent): void {
    const { reply_to, change } = JSON.parse(event.data);
    if (reply_to !== undefined) {
      this.pending.delete(reply_to);
    }
    this.engine.change(change);
  }
}

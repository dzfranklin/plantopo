import { SyncTransport } from './SyncTransport';
import WS, { WebSocketServer } from 'ws';
import { server as mswServer } from '@/mocks/server';
import { IncomingSessionMsg } from './sessionMsg';

let subject: SyncTransport;
let srv: MockServer;
beforeEach(() => {
  mswServer.close();
  srv = new MockServer();

  subject = new SyncTransport({
    clientId: 'test-client',
    mapId: 'test-map',
    endpoint: srv.endpoint,
  });
});

afterEach(() => {
  subject.destroy();
  srv.destroy();
});

it('connects', async () => {
  await waitForStatus((s) => s.type === 'connected' && !s.loadComplete);
  srv.send({ initialLoadComplete: true });
  await waitForStatus((s) => s.type === 'connected' && s.loadComplete);
});

function waitForStatus(p: (s: SyncTransport['status']) => boolean) {
  return new Promise<void>((resolve) => {
    const unsubscribe = subject.addOnStatusListener((status) => {
      if (p(status)) {
        unsubscribe();
        resolve();
      }
    });
  });
}

class MockServer {
  readonly endpoint: string;

  private _srv: WebSocketServer;
  private _conns: Array<WS> = [];
  private _connListeners = new Set<() => any>();

  constructor() {
    this._srv = new WebSocketServer({
      port: 0,
    });

    this._srv.on('connection', (ws, _req) => {
      this._conns.push(ws);
      this._connListeners.forEach((l) => l());
    });

    const address = this._srv.address() as any as { port: number };
    this.endpoint = `ws://localhost:${address.port}/map`;
  }

  async send(msg: IncomingSessionMsg) {
    (await this._c()).send(JSON.stringify(msg));
  }

  private async _c(): Promise<WS> {
    while (true) {
      if (this._conns.length > 0) {
        return this._conns.at(-1)!;
      }
      await new Promise<void>((resolve) => {
        this._onConn(resolve);
      });
    }
  }

  private _onConn(l: () => any): () => void {
    this._connListeners.add(l);
    return () => this._connListeners.delete(l);
  }

  destroy() {
    this._srv.close();
  }
}

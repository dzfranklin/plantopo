import { FeatureChange } from '@/gen/sync_schema';
import { Changeset } from '../api/Changeset';
import { IncomingSessionMsg, OutgoingSessionMsg } from '../api/sessionMsg';
import { DocState, DocStore } from './DocStore';
import {
  ULID,
  factory as ulidFactory,
  detectPrng as ulidDetectPrng,
} from 'ulid';
import { SyncTransportStatus } from '../api/SyncTransport';
import { Looper, TimedLooper } from './Looper';

const SEND_INTERVAL_MS = 15;

export class StateManager {
  public readonly clientId: string;

  private _ulidFactory: ULID;
  private _generation = 1;
  private _latestSend = 0;
  private _latestAck = 0;
  private _store: DocStore;
  private _transport: ITransport;
  private _onChange?: (state: DocState) => any;
  private _destroy: Array<() => void> = [];

  constructor(config: {
    clientId: string;
    transport: ITransport;
    onChange?: (state: DocState) => any;
    looper?: Looper;
  }) {
    this.clientId = config.clientId;
    this._onChange = config.onChange;
    this._ulidFactory = ulidFactory(ulidDetectPrng(true));
    this._store = new DocStore();

    this._transport = config.transport;
    this._destroy.push(
      this._transport.addOnMessageListener(this._onMessage.bind(this)),
    );
    this._destroy.push(
      this._transport.addOnStatusListener(this._onTransportStatus.bind(this)),
    );

    const looper = config.looper || new TimedLooper(SEND_INTERVAL_MS);
    looper.do = this._onSendInterval.bind(this);
    this._destroy.push(() => looper.destroy());
    looper.start();
  }

  destroy() {
    this._destroy.forEach((fn) => fn());
  }

  update(change: Changeset) {
    this._store.localUpdate(this._generation, change);
    this._onChange?.(this._store.toState());
  }

  toState(): DocState {
    return this._store.toState();
  }

  private _onTransportStatus(status: SyncTransportStatus) {
    if (status.type === 'connected') {
      // on the next send interval resend any un-acked changes
      this._latestSend = this._latestAck;
    }
  }

  private _onMessage(msg: IncomingSessionMsg) {
    if (msg.ack !== undefined) {
      this._latestAck = Math.max(this._latestAck, msg.ack);
      this._store.remoteAck(msg.ack);
    }
    if (msg.change !== undefined) {
      this._store.remoteUpdate(this._generation, msg.change);
      this._onChange?.(this._store.toState());
    }
  }

  private _onSendInterval() {
    const change = this._store.localChangesAfter(this._latestSend);
    if (change) {
      const err = this._transport.send({
        seq: this._generation,
        change,
      });
      if (err) {
        console.error('failed to send change', err);
        return;
      }
      this._latestSend = this._generation;
      this._generation++;
    }
  }

  createFeature(value: Omit<FeatureChange, 'id'>): string {
    if (
      value.parent === undefined ||
      value.parent === null ||
      value.idx === undefined ||
      value.idx === null
    ) {
      throw new Error('new feature must have parent and idx');
    }
    const id = this._generateFid();
    this.update({
      fadd: [id],
      fset: { [id]: { ...value, id } },
    });
    return id;
  }

  private _generateFid(): string {
    return `${this.clientId}-${this._ulidFactory()}`;
  }
}

interface ITransport {
  addOnMessageListener(cb: (msg: IncomingSessionMsg) => any): () => void;
  addOnStatusListener(cb: (status: SyncTransportStatus) => any): () => void;
  send(msg: OutgoingSessionMsg): Error | null;
}
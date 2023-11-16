import { FeatureChange } from '@/gen/sync_schema';
import { Changeset } from '../api/Changeset';
import { IncomingSessionMsg, OutgoingSessionMsg } from '../api/sessionMsg';
import {
  DocState,
  DocStore,
  INITIAL_UNDO_STATUS,
  UndoStatus,
} from './DocStore';
import {
  ULID,
  factory as ulidFactory,
  detectPrng as ulidDetectPrng,
} from 'ulid';
import {
  INITIAL_SYNC_TRANSPORT_STATUS,
  SyncTransportStatus,
} from '../api/SyncTransport';
import { Looper, TimedLooper } from './Looper';

const SEND_INTERVAL_MS = 15;

export interface StateStatus {
  loaded: boolean;
  hasChanges: boolean;
  unsyncedChanges: boolean;
  undoStatus: UndoStatus;
  transport: SyncTransportStatus;
}

export const INITIAL_STATE_STATUS: StateStatus = {
  loaded: false,
  hasChanges: false,
  unsyncedChanges: false,
  undoStatus: INITIAL_UNDO_STATUS,
  transport: INITIAL_SYNC_TRANSPORT_STATUS,
};

export class StateManager {
  public readonly clientId: string;
  public readonly mayEdit: boolean;

  private _ulidFactory: ULID;
  private _hasUnsent = false;
  private _generation = 1;
  private _latestSend = 0;
  private _latestAck = 0;
  private _s: DocStore;
  private _t: ITransport;
  private _onChange?: (state: DocState) => any;
  private _destroy: Array<() => void> = [];

  constructor(config: {
    clientId: string;
    transport: ITransport;
    mayEdit: boolean;
    onChange?: (state: DocState) => any;
    looper?: Looper;
  }) {
    this.clientId = config.clientId;
    this.mayEdit = config.mayEdit;
    this._onChange = config.onChange;
    this._ulidFactory = ulidFactory(ulidDetectPrng(true));

    const s = new DocStore();
    this._s = s;
    this._destroy.push(
      s.addUndoStatusListener((st) => this._updateStatus({ undoStatus: st })),
    );

    const t = config.transport;
    this._t = t;
    this._destroy.push(t.addOnMessageListener(this._onMessage.bind(this)));
    this._destroy.push(t.addOnStatusListener(this._onTStatus.bind(this)));

    if (this.mayEdit) {
      const looper = config.looper || new TimedLooper(SEND_INTERVAL_MS);
      looper.do = this._onSendInterval.bind(this);
      this._destroy.push(() => looper.destroy());
      looper.start();
    }
  }

  destroy() {
    this._destroy.forEach((fn) => fn());
  }

  update(change: Changeset) {
    if (!this.mayEdit) {
      console.error('cannot update read-only doc');
      return;
    }
    this._s.localUpdate(this._generation, change);
    this._onChange?.(this._s.toState());
    this._hasUnsent = true;
    this._updateStatus({ hasChanges: true, unsyncedChanges: true });
  }

  undo() {
    this._s.undo(this._generation);
  }

  redo() {
    this._s.redo(this._generation);
  }

  toState(): DocState {
    return this._s.toState();
  }

  toChange(): Changeset | null {
    return this._s.toChange();
  }

  private _lastStatus: StateStatus = INITIAL_STATE_STATUS;
  private _statusListeners = new Set<(status: StateStatus) => any>();

  private _updateStatus(partial: Partial<StateStatus>) {
    this._lastStatus = { ...this._lastStatus, ...partial };
    this._statusListeners.forEach((cb) => cb(this._lastStatus));
  }

  status(): StateStatus {
    return this._lastStatus;
  }

  onStatus(cb: (status: StateStatus) => any): () => void {
    this._statusListeners.add(cb);
    return () => this._statusListeners.delete(cb);
  }

  private _onTStatus(status: SyncTransportStatus) {
    this._updateStatus({ transport: status });
    if (status.type === 'connected') {
      this._updateStatus({ loaded: status.initialLoadComplete });
      // on the next send interval resend any un-acked changes
      this._latestSend = this._latestAck;
    }
  }

  private _onMessage(msg: IncomingSessionMsg) {
    if (msg.ack) {
      this._latestAck = Math.max(this._latestAck, msg.ack);
      this._updateStatus({
        unsyncedChanges: this._hasUnsent || this._latestAck < this._generation,
      });
      this._s.remoteAck(msg.ack);
    }
    if (msg.change) {
      this._s.remoteUpdate(this._generation, msg.change);
      this._onChange?.(this._s.toState());
    }
  }

  private _onSendInterval() {
    const change = this._s.localChangesAfter(this._latestSend);
    if (change) {
      const _ = this._t.send({
        seq: this._generation,
        change,
      });
      this._hasUnsent = false;
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

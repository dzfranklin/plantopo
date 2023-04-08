import Dexie from 'dexie';
import { v4 as uuid } from 'uuid';
import { Feature, isFeatureType } from '../features/types';
import { Layer } from '../layers/types';
import { Op } from './types';

const db = new Dexie('map-sync');
db.version(1).stores({
  unsentOps: '++id, mapId',
});
const clocksTable = db.table<number, string>('clocks');
const unsentOpsTable = db.table<
  { id?: number; mapId: string; clientId: string; clock: number; op: Op },
  number
>('unsentOps');

type SendRemoteResult = 'ok' | 'retry' | 'fail';

interface Options {
  mapId: string;
  send: (op: Op) => SendRemoteResult;
  recv: (listener: (op: Op) => void) => void;
}

export class Sync {
  mapId: string;
  clientId: string;
  clock: number;

  _sendRemote: (op: Op) => SendRemoteResult;

  featureOrder: Map<string, [string, string][]> = new Map();
  featureOrderListeners: Map<string, Set<FeatureOrderListener>> = new Map();

  feature: Map<string, Feature> = new Map();
  layerOrder: [string, string][];
  layer: Map<string, Layer> = new Map();

  constructor(options: Options) {
    this.mapId = options.mapId;
    this.clientId = uuid();
    this._sendRemote = options.send;
    options.recv((op) => this._recvRemote(op));
  }

  async send(op: Op) {
    const mapId = this.mapId;

    await unsentOpsTable.add({ mapId, op });
    for (;;) {
      const result = this._sendRemote(op);
      if (result === 'ok') {
        await unsentOpsTable.delete(clock);
        break;
      } else if (result === 'fail') {
        break;
      }
    }
  }

  private _recvRemote(op: Op) {
    this._apply(op);
  }

  // TODO: what about ordering by clock?

  private _apply(op: Op) {
    this.clock = Math.max(this.clock, op.clock) + 1;

    if (op.type === 'createFeature') {
      const { featureId, featureType, at } = op;
      if (!isFeatureType(featureType)) return;

      const feature: Feature = {
        id: featureId,
        type: featureType,
        at,
      };
      this.feature.set(featureId, feature);

      const [parentId, idx] = at;
      const order = this.featureOrder.get(parentId) ?? [];
      order.push([featureId, idx]);
      order.sort(orderCmp);
      this.featureOrder.set(parentId, order);
      this._callFeatureOrderSubsrcibers(parentId);
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    } else if (op.type === 'trashFeature') {
      const { featureId } = op;
      const feature = this.feature.get(featureId);
      if (feature === undefined) return;
      this.feature.delete(featureId);

      const [parentId] = feature.at;
      const order = this.featureOrder.get(parentId);
      if (order === undefined) return;
      const idx = order.findIndex(([id]) => id === featureId);
      if (idx === -1) return;
      order.splice(idx, 1);
      this._callFeatureOrderSubsrcibers(parentId);
    } else {
      // Unknown op
    }
  }

  subscribeFeatureOrder(parent: string, listener: FeatureOrderListener) {
    const set = this.featureOrderListeners.get(parent) ?? new Set();
    set.add(listener);
    this.featureOrderListeners.set(parent, set);

    const current = orderToIds(this.featureOrder.get(parent));
    listener(current);
  }
  unsubscribeFeatureOrder(parent: string, listener: FeatureOrderListener) {
    this.featureOrderListeners.get(parent)?.delete(listener);
  }
  private _callFeatureOrderSubsrcibers(parent: string) {
    const listeners = this.featureOrderListeners.get(parent);
    if (!listeners) return;

    const ids = orderToIds(this.featureOrder.get(parent));
    for (const listener of listeners) {
      listener(ids);
    }
  }
}

type FeatureOrderListener = (order: string[]) => void;

const orderToIds = (order: [string, string][] | undefined) =>
  order?.map(([id]) => id) ?? [];

const orderCmp = (
  [aId, aIdx]: [string, string],
  [bId, bIdx]: [string, string],
) => {
  if (aIdx < bIdx) return -1;
  if (aIdx > bIdx) return 1;
  if (aId < bId) return -1;
  if (aId > bId) return 1;
  return 0;
};

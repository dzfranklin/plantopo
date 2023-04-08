import { JsonObject, JsonTemplateObject } from '@sanalabs/json';
import { BaseAwarenessState } from '../../../vendor/collaboration-kit/packages/y-redux/src/index';
import { Features, Index } from '../features/types';
import { Layers } from '../layers/types';
import { ViewAt } from '../ViewAt';
import { Awareness as YAwareness } from 'y-protocols/awareness';

export type SocketStatus = 'disconnected' | 'connecting' | 'connected';

export interface SyncState {
  aware?: YAwareness;
  initialViewAt?: ViewAt;
  status: SocketStatus;
}

export interface PeerAwareData extends AwareData, BaseAwarenessState {
  clientId: number;
}

export interface AwareData extends JsonObject {
  user?: { username: string; id: string };
  viewAt?: ViewAt;
  activeFeature?: string;
  [other: string]: any;
}

export const KNOWN_SYNC_DATA = ['layers', 'is3d', 'features', 'featureTrash'];

export interface SyncData extends JsonTemplateObject {
  layers?: Layers;
  is3d?: boolean;
  features?: Features;
  featureTrash?: Features;
  [other: string]: any;
}

export type Op = CreateFeatureOp | TrashFeatureOp;

interface OpBase {
  clientId: string;
  clock: number;
}

export interface CreateFeatureOp extends OpBase {
  type: 'createFeature';
  featureId: string;
  featureType: string;
  at: Index;
}

export interface TrashFeatureOp extends OpBase {
  type: 'trashFeature';
  featureId: string;
}

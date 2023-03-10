import { Features } from '../features/types';
import { Layers } from '../layers/types';
import { ViewAt } from '../ViewAt';

export type PeerAware = Aware & { clientId: number; isCurrentClient: boolean };

export interface Aware {
  user?: { username: string; id: string };
  viewAt?: ViewAt;
  activeFeature?: string;
}

export interface SyncData {
  layers: Layers;
  is3d: boolean;
  features: Features;
  featureTrash: Features;
}

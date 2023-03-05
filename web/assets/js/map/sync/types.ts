import { Features } from '../features/features';
import { Layer } from '../layers/types';
import { ViewAt } from '../ViewAt';

export type PeerAware = Aware & { clientId: number; isCurrentClient: boolean };

export interface Aware {
  user?: { username: string; id: string };
  viewAt?: ViewAt;
  activeFeature?: string;
}

export interface SyncData {
  layers: Layer[];
  is3d: boolean;
  features: Features;
  featureTrash: Features;
}

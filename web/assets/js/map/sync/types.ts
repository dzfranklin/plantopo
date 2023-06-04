import { ViewAt } from '../ViewAt';
import { Feature } from '../features/types';
import { Layer } from '../layers/types';

export interface SyncToken {
  token: string;
  mapId: string;
  clientId: string;
  userId: string | undefined;
  write: boolean;
  exp: string;
}

export type SyncStatus =
  | { type: 'connecting'; willRetryAt?: number }
  | { type: 'connected' }
  | { type: 'disconnected' };

export interface SyncState {
  aware: {
    myId: string;
    my: AwareState;
    peers: {
      [id: string]: AwareState;
    };
  };

  attrs: {
    [key: string]: unknown;
  };

  layers: Layer[];

  features: {
    order: {
      [id: string]: string[];
    };

    value: {
      [id: string]: Feature;
    };
  };
}

export interface AwareState {
  user: string | undefined;
  // viewAt?: ViewAt;
  activeFeature: string | undefined;
}

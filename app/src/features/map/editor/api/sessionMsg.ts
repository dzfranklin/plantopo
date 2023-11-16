import { Changeset } from './Changeset';

export interface OutgoingSessionMsg {
  seq?: number;
  aware?: SetAwareRequest;
  change?: Changeset;
}

export interface SetAwareRequest {
  camera?: AwareCamera;
  selectedFeatures?: string[];
}

export interface IncomingSessionMsg {
  ack?: number;
  initialLoadComplete?: boolean;
  aware?: Record<string, AwareEntry>;
  change?: Changeset;
  error?: string;
}

export interface AwareEntry {
  camera?: AwareCamera;
  selectedFeatures?: string[];
  trusted: {
    clientId: string;
    avatarURL?: string;
    userId?: string;
    name?: string;
  };
}

export interface AwareCamera {
  lng: number;
  lat: number;
  zoom: number;
  bearing: number;
  pitch: number;
}

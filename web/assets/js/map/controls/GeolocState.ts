import { LngLat } from '../LngLat';

export interface GeolocState {
  updating: boolean;
  value?: {
    accuracy: number;
    position: LngLat;
  };
}

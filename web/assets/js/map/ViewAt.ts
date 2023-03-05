import { LngLat } from './LngLat';

export interface ViewAt {
  center: LngLat;
  zoom: number;
  pitch: number;
  bearing: number;
}

export type LngLat = [number, number];

export interface ViewAt {
  center: LngLat;
  zoom: number;
  pitch: number;
  bearing: number;
}

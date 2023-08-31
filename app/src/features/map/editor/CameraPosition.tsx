export interface CameraPosition {
  lng: number;
  lat: number;
  zoom: number;
  bearing: number;
  pitch: number;
}

export const ZERO_CAMERA: CameraPosition = {
  lng: 0,
  lat: 0,
  zoom: 0,
  bearing: 0,
  pitch: 0,
};

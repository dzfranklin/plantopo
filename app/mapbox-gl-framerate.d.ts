declare module '@mapbox/mapbox-gl-framerate' {
  type ml = import('mapbox-gl');

  export default class FrameRateControl {
    public onAdd(map: ml.Map): HTMLElement;

    onRemove(): void;
  }
}

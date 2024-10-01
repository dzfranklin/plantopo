declare module '@mapbox/mapbox-gl-framerate' {
  export default class FrameRateControl {
    public onAdd(map: any): HTMLElement;

    onRemove(): void;
  }
}

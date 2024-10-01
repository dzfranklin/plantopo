import * as ml from 'maplibre-gl';
import { createElement } from '@/domUtil';

export class OSLogoControl implements ml.IControl {
  private _container = createElement({
    className: 'p-2 flex justify-end',
    contents: createElement({
      tag: 'img',
      width: '90',
      height: '24',
      src: '/os-logo-maps.svg',
      alt: 'Ordnance Survey maps logo',
    }),
  });

  onAdd(_map: ml.Map): HTMLElement {
    return this._container;
  }

  onRemove(_map: ml.Map): void {
    this._container?.remove();
  }

  getDefaultPosition = (): ml.ControlPosition => 'bottom-right';
}

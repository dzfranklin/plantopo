import * as ml from 'maplibre-gl';

export class OSLogoControl implements ml.IControl {
  private _container: HTMLElement | undefined;

  onAdd(_map: ml.Map): HTMLElement {
    this._container = document.createElement('div');
    this._container.style.padding = '8px';

    const el = document.createElement('img');
    this._container.append(el);
    el.src = '/os-logo-maps.svg';
    el.width = 90;
    el.height = 24;
    el.alt = 'Ordnance Survey maps logo';
    el.style.marginLeft = 'auto';

    return this._container;
  }

  onRemove(_map: ml.Map): void {
    this._container?.remove();
  }

  getDefaultPosition = (): ml.ControlPosition => 'bottom-right';
}

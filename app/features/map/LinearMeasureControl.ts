import * as ml from 'maplibre-gl';
import { createElement } from '@/domUtil';

export class LinearMeasureControl implements ml.IControl {
  private _c = createElement({
    className: 'maplibregl-ctrl maplibregl-ctrl-group',
    contents: {
      tag: 'button',
      innerHTML: 'M', // TODO: icon
    },
    onClick: () => this._toggle(),
  });
  private _active = false;

  onAdd(map: ml.Map): HTMLElement {
    return this._c;
  }

  onRemove(map: ml.Map): void {
    this._c.remove();
  }

  private _toggle() {
    if (this._active) {
      this._active = false;
    } else {
      this._active = true;
    }
  }
}

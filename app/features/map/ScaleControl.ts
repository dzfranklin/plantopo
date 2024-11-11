import { ControlPosition, IControl, Map } from 'maplibre-gl';
import { createElement } from '@/domUtil';
import { formatDistanceText, UnitSystem } from '@/features/units/format';
import cls from '@/cls';

// Based on maplibre's ScaleControl

const barWidth = 150;

export class ScaleControl implements IControl {
  private _barEl = createElement({
    className: cls(
      'maplibregl-ctrl',
      'pb-[0.5px]',
      'border-b border-l border-r border-black',
      'text-center text-[12px] select-none',
    ),
    style: { width: `${barWidth}px` },
  });

  private _m: Map | null = null;
  private _units: UnitSystem | undefined;

  constructor(props: { units?: UnitSystem }) {
    this._units = props.units;
  }

  onAdd(m: Map): HTMLElement {
    this._m = m;
    m.on('move', this._update);
    this._update();
    return this._barEl;
  }

  onRemove(m: Map): void {
    m.off('move', this._update);
    this._m = null;
    this._barEl.remove();
  }

  setUnits(units: UnitSystem | undefined): void {
    this._units = units;
    this._update();
  }

  private _update = () => {
    if (!this._m) return;

    const y = this._m.getContainer().clientHeight / 2;
    const left = this._m.unproject([0, y]);
    const right = this._m.unproject([barWidth, y]);
    const distanceMeters = left.distanceTo(right);

    this._barEl.innerText = formatDistanceText(distanceMeters, this._units);
  };

  getDefaultPosition(): ControlPosition {
    return 'bottom-right';
  }
}

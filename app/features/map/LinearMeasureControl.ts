import * as ml from 'maplibre-gl';
import { createElement } from '@/domUtil';
import { MapMouseEvent } from 'mapbox-gl';
import { featureCollection, lineString, point } from '@turf/helpers';
import { Geometry } from 'geojson';
import { onceMapLoaded } from '@/features/map/util';
import { metersBetween } from '@/geo';
import { formatDistanceText, UnitSystem } from '@/features/units/format';

const prefix = 'pLinearMeasureControl:';
const sourceID = prefix + 'source';

const activeClass = 'text-blue-600';

// credit: https://github.com/korywka/mapbox-controls (MIT license)
const iconSource =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="23" height="23" fill="currentColor">\n' +
  '<rect fill="none" height="24" width="24"></rect>\n' +
  '<path d="M20,6H4C2.9,6,2,6.9,2,8v8c0,1.1,0.9,2,2,2h16c1.1,0,2-0.9,2-2V8C22,6.9,21.1,6,20,6z M20,16H4V8h3v3c0,0.55,0.45,1,1,1h0 c0.55,0,1-0.45,1-1V8h2v3c0,0.55,0.45,1,1,1h0c0.55,0,1-0.45,1-1V8h2v3c0,0.55,0.45,1,1,1h0c0.55,0,1-0.45,1-1V8h3V16z"></path>\n' +
  '</svg>';

const layers: ml.LayerSpecification[] = [
  {
    id: prefix + 'line',
    type: 'line',
    source: sourceID,
    filter: ['==', ['get', 'type'], 'line'],
    paint: {
      'line-width': 2.5,
      'line-color': 'rgb(249 115 22)',
      'line-dasharray': [1, 1],
    },
  },
  {
    id: prefix + 'control-point',
    type: 'symbol',
    source: sourceID,
    filter: ['==', ['get', 'type'], 'control-point'],
    layout: {
      'icon-image': '/marker@2x.png',
      'icon-size': 0.3,
      'text-field': [
        'case',
        ['>', ['get', 'i'], 0],
        ['get', 'runningDistance'],
        '',
      ],
      'text-size': 12,
      'text-offset': [0, 1],
      'text-letter-spacing': 0.05,
    },
    paint: {
      'icon-color': 'rgb(249 115 22)',
      'text-halo-color': 'rgb(256,256,256)',
      'text-halo-width': 1.5,
    },
  },
];

export class LinearMeasureControl implements ml.IControl {
  private _b = createElement({
    tag: 'button',
    title: 'Ruler',
    onclick: () => this._toggle(),
    contents: {
      className: 'flex justify-center align-center',
      innerHTML: iconSource,
    },
  });
  private _c = createElement({
    className: 'maplibregl-ctrl maplibregl-ctrl-group',
    contents: this._b,
  });

  private _units?: UnitSystem;

  private _m: ml.Map | null = null;
  private _s: ml.GeoJSONSource | null = null;

  private _cleanup: Array<() => void> = [];

  constructor(props: { units?: UnitSystem }) {
    this._units = props.units;
  }

  onAdd(m: ml.Map): HTMLElement {
    this._m = m;
    this._cleanup.push(() => (this._m = null));

    onceMapLoaded(m, () => {
      const clickHandler = (evt: MapMouseEvent) => this._onClick(evt);
      m.on('click', clickHandler);
      this._cleanup.push(() => m.off('click', clickHandler));

      const keypressHandler = (evt: KeyboardEvent) => this._onKeyPress(evt);
      window.addEventListener('keypress', keypressHandler);
      this._cleanup.push(() =>
        window.removeEventListener('keypress', keypressHandler),
      );

      m.addSource(sourceID, {
        type: 'geojson',
        data: featureCollection([]),
      });
      this._s = m.getSource(sourceID)! as ml.GeoJSONSource;

      layers.forEach((l) => m.addLayer(l));

      this._cleanup.push(() => {
        // Must remove layers before source
        layers.forEach((l) => m.removeLayer(l.id));
        m.removeSource(sourceID);
        this._s = null;
      });

      this._update();
    });

    return this._c;
  }

  onRemove(_m: ml.Map): void {
    this._cleanup.forEach((f) => f());
    this._cleanup = [];
    this._c.remove();
  }

  setUnits(unit?: UnitSystem) {
    this._units = unit;
    this._update();
  }

  private _active = false;
  private _points: [number, number][] = [];

  private _prevCursor: string | undefined;

  private _toggle() {
    if (!this._m || !this._s) return;
    if (this._active) {
      this._active = false;

      this._b.classList.remove(activeClass);

      this._points = [];
      this._update(() => []);

      this._m.getCanvas().style.cursor = this._prevCursor ?? '';
    } else {
      this._active = true;

      this._b.classList.add(activeClass);

      this._prevCursor = this._m.getCanvas().style.cursor;
      this._m.getCanvas().style.cursor = 'crosshair';
    }
  }

  private _onClick(evt: MapMouseEvent) {
    if (!this._active || !this._m) return;
    evt.preventDefault();
    const { lng, lat } = evt.lngLat;
    this._update((p) => [...p, [lng, lat]]);
  }

  private _onKeyPress(evt: KeyboardEvent) {
    if (evt.key === 'Enter' && !evt.altKey && !evt.ctrlKey && !evt.metaKey) {
      if (this._active) {
        evt.preventDefault();
        evt.stopPropagation();
        this._toggle();
      }
    }
  }

  private _update(f?: (prev: [number, number][]) => [number, number][]) {
    if (!this._m || !this._s) return;

    if (f) {
      this._points = f(this._points);
    }
    const points = this._points;

    const gj = featureCollection<Geometry>([]);

    let runningMeters = 0;
    for (let i = 0; i < points.length; i++) {
      const p = points[i]!;
      if (i > 0) {
        runningMeters += metersBetween(points[i - 1]!, p);
      }
      gj.features.push(
        point(p, {
          type: 'control-point',
          i,
          runningDistance: formatDistanceText(runningMeters, this._units),
        }),
      );
    }

    if (points.length > 1) {
      gj.features.push(lineString(points, { type: 'line' }));
    }

    this._s.setData(gj);
  }
}

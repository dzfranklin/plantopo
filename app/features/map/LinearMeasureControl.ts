import * as ml from 'maplibre-gl';
import { createElement } from '@/domUtil';
import { feature, featureCollection, lineString, point } from '@turf/helpers';
import { Geometry, LineString, Position } from 'geojson';
import { onceMapLoaded } from '@/features/map/util';
import { metersBetween } from '@/geo';
import { formatDistanceText, UnitSystem } from '@/features/units/format';
import { SnapGraph } from '@/features/map/snap/SnapGraph';

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
    },
  },
  {
    id: prefix + 'activeSnap',
    type: 'line',
    source: sourceID,
    filter: ['==', ['get', 'type'], 'activeSnap'],
    paint: {
      'line-width': 2.5,
      'line-color': 'rgb(249 115 22)',
      'line-opacity': 0.6,
    },
  },
  {
    id: prefix + 'control-point',
    type: 'symbol',
    source: sourceID,
    filter: ['==', ['get', 'type'], 'control-point'],
    layout: {
      'icon-image': '/sprites/marker@2x.png',
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
      m.on('click', this._onClick);
      this._cleanup.push(() => m.off('click', this._onClick));

      // the keypress event doesn't fire on escape
      window.addEventListener('keyup', this._onKeyUp);
      this._cleanup.push(() =>
        window.removeEventListener('keyup', this._onKeyUp),
      );

      m.on('mousemove', this._onMouseMove);
      this._cleanup.push(() => m.off('mousemove', this._onMouseMove));

      m.on('render', this._onRender);
      this._cleanup.push(() => m.off('render', this._onRender));

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

  getDefaultPosition(): ml.ControlPosition {
    return 'top-right';
  }

  setUnits(unit?: UnitSystem) {
    this._units = unit;
    this._update();
  }

  private _active = false;
  private _activeSnap: LineString | null = null;
  private _points: Position[] = [];
  private _graph: SnapGraph | null = null;

  private _prevCursor: string | undefined;

  private _toggle() {
    if (!this._m || !this._s) return;
    if (this._active) {
      this._active = false;

      this._b.classList.remove(activeClass);

      this._graph = null;

      this._points = [];
      this._activeSnap = null;
      this._update(() => []);

      this._m.getCanvas().style.cursor = this._prevCursor ?? '';
    } else {
      this._active = true;

      this._b.classList.add(activeClass);

      this._graph = SnapGraph.fromRenderedFeatures(this._m);

      this._prevCursor = this._m.getCanvas().style.cursor;
      this._m.getCanvas().style.cursor = 'crosshair';
    }
  }

  private _onClick = (evt: ml.MapMouseEvent) => {
    if (!this._active || !this._m) return;
    evt.preventDefault();
    const pt = evt.lngLat;
    const snapped = this._findSnap(pt);
    if (snapped) {
      this._update((p) => [...p, ...snapped.coordinates]);
    } else {
      this._update((p) => [...p, [pt.lng, pt.lat]]);
    }
  };

  private _onKeyUp = (evt: KeyboardEvent) => {
    const anyModifier = evt.altKey || evt.ctrlKey || evt.metaKey;
    if ((evt.key === 'Enter' || evt.key === 'Escape') && !anyModifier) {
      if (this._active) {
        evt.preventDefault();
        evt.stopPropagation();
        this._toggle();
      }
    }
  };

  private _onMouseMove = (evt: ml.MapMouseEvent) => {
    if (!this._active) return;
    this._activeSnap = this._findSnap(evt.lngLat);
    this._update();
  };

  private _onRender = () => {
    if (this._active && this._m) {
      this._graph = SnapGraph.fromRenderedFeatures(this._m);
    }
  };

  private _findSnap(to: ml.LngLat): LineString | null {
    if (!this._graph) return null;

    const prev = this._points.at(-1);
    if (!prev) return null;

    return this._graph.search(prev, [to.lng, to.lat]);
  }

  private _update(f?: (prev: Position[]) => Position[]) {
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
      gj.features.push(lineString(points, { type: 'line', noSnap: true }));
    }

    if (this._activeSnap !== null) {
      gj.features.push(
        feature(this._activeSnap, { type: 'activeSnap', noSnap: true }),
      );
    }

    this._s.setData(gj);
  }
}

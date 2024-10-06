import * as ml from 'maplibre-gl';
import { createElement } from '@/domUtil';
import { feature, featureCollection, lineString, point } from '@turf/helpers';
import { Geometry, LineString, Position } from 'geojson';
import { mapBBox, onceMapLoaded } from '@/features/map/util';
import { lineStringGeometry, metersBetween } from '@/geo';
import { formatDistanceText, UnitSystem } from '@/features/units/format';
import { HighwayGraph } from '@/features/map/snap/HighwayGraph';

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
    id: prefix + 'line-outline',
    type: 'line',
    source: sourceID,
    paint: {
      'line-width': 6,
      'line-color': '#FFFFFF',
    },
  },
  {
    id: prefix + 'line-inner',
    type: 'line',
    source: sourceID,
    filter: ['!=', ['get', 'type'], 'activeSnap'],
    paint: {
      'line-width': 2,
      'line-color': 'rgb(249 115 22)',
    },
  },
  {
    id: prefix + 'line-inner-active',
    type: 'line',
    source: sourceID,
    filter: ['==', ['get', 'type'], 'activeSnap'],
    paint: {
      'line-width': 2,
      'line-color': 'rgb(249 115 22)',
      'line-dasharray': [3, 2],
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

  private _g: HighwayGraph;
  private _m: ml.Map | null = null;
  private _s: ml.GeoJSONSource | null = null;

  private _cleanup: Array<() => void> = [];

  constructor(props: { units?: UnitSystem; highwayGraph: HighwayGraph }) {
    this._units = props.units;
    this._g = props.highwayGraph;
  }

  onAdd(m: ml.Map): HTMLElement {
    this._m = m;
    this._cleanup.push(() => (this._m = null));

    onceMapLoaded(m, () => {
      m.on('click', this._onClick);
      this._cleanup.push(() => m.off('click', this._onClick));

      // the keypress event doesn't fire on escape
      window.addEventListener('keyup', this._onKeyUp);
      window.addEventListener('keydown', this._onKeyDown);
      this._cleanup.push(() => {
        window.removeEventListener('keyup', this._onKeyUp);
        window.removeEventListener('keydown', this._onKeyDown);
      });

      m.on('mousemove', this._onMouseMove);
      this._cleanup.push(() => m.off('mousemove', this._onMouseMove));

      m.on('moveend', this._onMoveEnd);
      this._cleanup.push(() => m.off('moveend', this._onMoveEnd));

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

  private _prevCursor: string | undefined;

  private _cancelGraphLoad: (() => void) | undefined;

  private _updateGraph() {
    this._cancelGraphLoad?.();
    if (this._m) {
      this._cancelGraphLoad = this._g.load(mapBBox(this._m));
    }
  }

  private _toggle() {
    if (!this._m || !this._s) return;
    if (this._active) {
      this._active = false;

      this._b.classList.remove(activeClass);

      this._points = [];
      this._activeSnap = null;
      this._update(() => []);

      this._m.getCanvas().style.cursor = this._prevCursor ?? '';

      this._cancelGraphLoad?.();
    } else {
      this._active = true;

      this._b.classList.add(activeClass);

      this._prevCursor = this._m.getCanvas().style.cursor;
      this._m.getCanvas().style.cursor = 'crosshair';

      this._updateGraph();
    }
  }

  private _onMoveEnd = () => {
    if (this._active) {
      this._updateGraph();
    }
  };

  private _shiftKeyPressed = false;

  private _onClick = (evt: ml.MapMouseEvent) => {
    if (!this._active || !this._m) return;
    evt.preventDefault();
    const pt = evt.lngLat;
    const snap = this._activeSnap;
    if (snap) {
      this._update((p) => [...p, ...snap.coordinates]);
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
    } else if (evt.key === 'Shift') {
      this._shiftKeyPressed = false;
    }
  };

  private _onKeyDown = (evt: KeyboardEvent) => {
    if (evt.key === 'Shift') {
      this._shiftKeyPressed = true;
    }
  };

  private _onMouseMove = (evt: ml.MapMouseEvent) => {
    if (!this._active) return;
    this._activeSnap = this._findSnap(evt.lngLat);
    this._update();
  };

  private _findSnap(to: ml.LngLat): LineString | null {
    const prev = this._points.at(-1);
    if (!prev) return null;
    if (this._shiftKeyPressed) {
      return lineStringGeometry([prev, [to.lng, to.lat]]);
    } else {
      return this._g.findPath(prev, [to.lng, to.lat], 20_000);
    }
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

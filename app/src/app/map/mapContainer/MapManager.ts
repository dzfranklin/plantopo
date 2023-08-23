import { LOrderOp, Lid, RootGeoJson, SyncEngine } from '@/sync/SyncEngine';
import * as ml from 'maplibre-gl';
import { EditStartChannel, EditStartEvent } from '../EditStartChannel';
import { LAYERS } from '@/layers';
import MapboxDraw from '@mapbox/mapbox-gl-draw';

const GLYPH_URL =
  'https://maptiler-proxy.localhost/fonts/{fontstack}/{range}.pbf';

export interface CameraPosition {
  lng: number;
  lat: number;
  zoom: number;
  bearing: number;
  pitch: number;
}

export class MapManager extends ml.Map {
  private _engine: SyncEngine;
  private _editStart: EditStartChannel;
  private _activeLayers: Lid[] = [];
  private _draw: MapboxDraw;
  private _topLeftControls: HTMLDivElement;
  private _hasUserMove = false;
  private _pendingSetup: Array<(map: this) => void> | null = [];

  private _boundOnFGeoJson = this._onFGeoJson.bind(this);
  private _boundOnLOrder = this._onLOrder.bind(this);
  private _boundOnLProps = this._onLProps.bind(this);

  private _fGeoJsonSource: ml.GeoJSONSource | undefined;

  constructor({
    container,
    engine,
    editStart,
    onMoveEnd,
    initialCamera,
  }: {
    container: HTMLElement;
    engine: SyncEngine;
    editStart: EditStartChannel;
    onMoveEnd: (_: CameraPosition) => void;
    initialCamera: CameraPosition | null;
  }) {
    super({
      container: container,
      style: {
        version: 8,
        sources: LAYERS.tilesets,
        layers: [],
        glyphs: GLYPH_URL,
        sprite: Object.entries(LAYERS.sprites).map(([id, url]) => ({
          id,
          url,
        })),
      },
      center: [initialCamera?.lng || 0, initialCamera?.lat || 0],
      pitch: initialCamera?.pitch || 0,
      bearing: initialCamera?.bearing || 0,
      zoom: initialCamera?.zoom || 0,
      keyboard: true,
      attributionControl: false, // So that we can implement our own
    });

    this._engine = engine;
    this._editStart = editStart;

    this._topLeftControls = this._container.querySelector(
      '.maplibregl-ctrl-top-left',
    )!;

    this._draw = new MapboxDraw({
      controls: {
        combine_features: false,
        uncombine_features: false,
      },
    });
    this.addControl(this._draw as unknown as ml.IControl, 'top-left');
    this._fixMbClasses(['mapboxgl-ctrl-group', 'mapboxgl-ctrl']);

    this.once('styledata', () => this._setup());

    // The first move is fired to set it to the value configued in the style
    this.on('moveend', () => {
      const center = this.getCenter();
      const camera: CameraPosition = {
        lng: center.lng,
        lat: center.lat,
        bearing: this.getBearing(),
        pitch: this.getPitch(),
        zoom: this.getZoom(),
      };

      if (!this._hasUserMove) {
        this._hasUserMove =
          camera.lng > 0.001 ||
          camera.lat > 0.001 ||
          camera.bearing > 0.001 ||
          camera.pitch > 0.001 ||
          camera.zoom > 0.001;
      }

      if (this._hasUserMove) onMoveEnd(camera);
    });

    console.log('MapManager', this);
  }

  onceSetup(cb: (map: this) => void) {
    if (this._pendingSetup !== null) this._pendingSetup.push(cb);
    else cb(this);
  }

  private _setup() {
    this.addControl(new ml.NavigationControl());
    this.addControl(new ml.FullscreenControl());
    this.addControl(new ml.GeolocateControl({}));

    this.addSource('fGeoJson', {
      type: 'geojson',
      data: this._engine.fGeoJson(),
    });
    this._fGeoJsonSource = this.getSource('fGeoJson')! as any;

    this._activeLayers = this._engine.lOrder();
    for (let i = this._activeLayers.length - 1; i >= 0; i--) {
      const lid = this._activeLayers[i]!;
      const layer = LAYERS.layers[lid];
      if (!layer) throw new Error(`Missing layer ${lid}`);
      for (const subl of layer.sublayers) {
        try {
          this.addLayer(subl);
        } catch (err) {
          throw new Error(`Failed to add sublayer ${JSON.stringify(subl)}`, {
            cause: err instanceof Error ? err : undefined,
          });
        }
      }
      const opacity = this._engine.lGet(lid, 'opacity') || layer.defaultOpacity;
      if (opacity !== 1) this._setLayerOpacity(lid, opacity);
    }

    this._engine.addFGeoJsonListener(this._boundOnFGeoJson);
    this._engine.addLOrderListener(this._boundOnLOrder);
    this._engine.addLPropsListener(this._boundOnLProps);

    this._editStart.on = this._onEditStart.bind(this);

    console.log('Setup maplibre Map', this);

    for (const cb of this._pendingSetup!) cb(this);
    this._pendingSetup = null;
  }

  private _pendingSidebarResize: number | null = null;
  resizeForSidebar(sidebarWidth: number) {
    if (this._pendingSidebarResize !== null) {
      cancelAnimationFrame(this._pendingSidebarResize);
    }
    this._pendingSidebarResize = requestAnimationFrame(() => {
      this._pendingSidebarResize = null;
      this._topLeftControls.style.left = `${sidebarWidth}px`;
    });
  }

  private _fixMbClasses(classes: string[]) {
    for (const cls of classes) {
      for (const el of this._container.getElementsByClassName(cls)) {
        el.classList.add(cls.replace('mapboxgl', 'maplibregl'));
      }
    }
  }

  remove() {
    this._engine.removeFGeoJsonListener(this._boundOnFGeoJson);
    this._engine.removeLOrderListener(this._boundOnLOrder);
    this._engine.removeLPropsListener(this._boundOnLProps);
    this._fGeoJsonSource = undefined;
    this._editStart.on = undefined;
    super.remove();
    console.log('MapManager.remove');
  }

  private _onEditStart(evt: EditStartEvent) {
    console.warn('TODO: ', evt);
  }

  private _prevSetFGeoJson: number | undefined;
  private _onFGeoJson(value: RootGeoJson) {
    if (this._prevSetFGeoJson !== undefined) {
      cancelIdleCallback(this._prevSetFGeoJson);
    }
    this._prevSetFGeoJson = requestIdleCallback(
      () => {
        this._fGeoJsonSource!.setData(
          value as GeoJSON.FeatureCollection<GeoJSON.Geometry>,
        );
      },
      { timeout: 100 },
    );
  }

  private _onLOrder(value: Lid[], changes: LOrderOp[]) {
    for (const op of changes) {
      const layer = LAYERS.layers[op.lid];
      if (!layer) throw new Error(`Missing layer ${op.lid}`);

      if (op.type === 'add') {
        let sublBefore: string | undefined;
        if (op.before !== undefined) {
          const layerBefore = LAYERS.layers[op.before];
          if (!layerBefore) throw new Error(`Missing layer ${op.before}`);
          sublBefore = layerBefore.sublayers.at(-1)?.id;
        }
        for (const subl of layer.sublayers) {
          try {
            this.addLayer(subl, sublBefore);
          } catch (err) {
            throw new Error(`Failed to add sublayer ${JSON.stringify(subl)}`, {
              cause: err instanceof Error ? err : undefined,
            });
          }
        }

        const opacity = this._engine.lGet(op.lid, 'opacity');
        this._setLayerOpacity(op.lid, opacity ?? layer.defaultOpacity);
      } else if (op.type === 'move') {
        let sublBefore: string | undefined;
        if (op.before !== undefined) {
          const layerAfter = LAYERS.layers[op.before];
          if (!layerAfter) throw new Error(`Missing layer ${op.before}`);
          sublBefore = layerAfter.sublayers[0]?.id;
        }
        for (const subl of layer.sublayers) {
          this.moveLayer(subl.id, sublBefore);
        }
      } else if (op.type === 'remove') {
        for (const subl of layer.sublayers) {
          this.removeLayer(subl.id);
        }
      }
    }
    this._activeLayers = value;
  }

  private _onLProps(lid: Lid, k: string, v: unknown) {
    if (!this._activeLayers.includes(lid)) return;
    if (k === 'opacity') {
      this._setLayerOpacity(lid, v as number | null);
    }
  }

  private _setLayerOpacity(lid: Lid, opacity: number | null) {
    const layer = LAYERS.layers[lid];
    if (!layer) throw new Error(`Missing layer ${lid}`);
    const multiplier = opacity ?? layer.defaultOpacity;
    for (const [id, props] of Object.entries(layer.sublayerOpacity)) {
      for (const [name, initialValue] of Object.entries(props)) {
        if (typeof initialValue === 'number') {
          this.setPaintProperty(id, name, initialValue * multiplier, {
            validate: false,
          });
        } else {
          this.setPaintProperty(id, name, ['*', initialValue, multiplier]);
        }
      }
    }
  }
}

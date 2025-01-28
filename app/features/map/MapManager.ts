import * as ml from 'maplibre-gl';
import { GeoJSON } from 'geojson';
import {
  BaseStyle,
  DynamicOverlayStyle,
  OverlayStyle,
  styleGlyphs,
  StyleVariables,
  StyleVariableSpec,
} from '@/features/map/style';
import { fitBoundsFor } from '@/features/map/util';
import { stringCmp } from '@/stringCmp';
import FrameRateControl from '@mapbox/mapbox-gl-framerate';

export type CameraOptions = {
  lng: number;
  lat: number;
  bearing: number;
  pitch: number;
  zoom: number;
};

export type MapManagerInitialView =
  | { at: CameraOptions }
  | { fit: ml.LngLatBoundsLike; options?: ml.FitBoundsOptions };

const frameRateControlPosition = 'bottom-left';

export class MapManager {
  readonly m: ml.Map;
  readonly baseStyle: BaseStyle;

  private _addedOverlaySources: string[] = [];
  private _addedOverlayLayers: string[] = [];
  private _addedLayers: string[] = [];

  private _frameRateControl: FrameRateControl | null = null;

  constructor(props: {
    container: HTMLDivElement;
    baseStyle: BaseStyle;
    initialView?: MapManagerInitialView;
    interactive: boolean;
  }) {
    this.baseStyle = props.baseStyle;

    const opts: ml.MapOptions = {
      container: props.container,
      interactive: props.interactive,
    };

    if (props.initialView && 'at' in props.initialView) {
      opts.center = [props.initialView.at.lng, props.initialView.at.lat];
      opts.zoom = props.initialView.at.zoom;
      opts.bearing = props.initialView.at.bearing;
      opts.pitch = props.initialView.at.pitch;
    } else if (props.initialView && 'fit' in props.initialView) {
      opts.bounds = props.initialView.fit;
      opts.fitBoundsOptions = props.initialView.options;
    }

    if (props.baseStyle.id === 'os') {
      opts.pitch = opts.minPitch = opts.maxPitch = 0;
      opts.minZoom = 3; // at very low zoom the projections don't match
    }

    this.m = new ml.Map(opts);

    this.m.setStyle(props.baseStyle.style, {
      diff: false,
      transformStyle: (_prev, next) => {
        return { ...next, glyphs: styleGlyphs };
      },
    });

    this.m.on('styleimagemissing', (evt) =>
      this._onStyleImageMissing(evt as ml.MapStyleImageMissingEvent),
    );
  }

  remove() {
    this.m.remove();
  }

  async setOverlays(
    overlays: (OverlayStyle | DynamicOverlayStyle)[],
    variables: StyleVariables['overlay'],
  ) {
    for (const layer of this._addedOverlayLayers) {
      this.m.removeLayer(layer);
    }
    this._addedOverlayLayers = [];

    for (const source of this._addedOverlaySources) {
      this.m.removeSource(source);
    }
    this._addedOverlaySources = [];

    const sortedOverlays = overlays
      .slice()
      .sort((a, b) => stringCmp(a.id, b.id));

    const resolvedOverlays = await Promise.all(
      sortedOverlays.map((v) =>
        'dynamic' in v ? this.resolveDynamicOverlay(v) : Promise.resolve(v),
      ),
    );

    for (const overlay of resolvedOverlays) {
      const prefix = `overlay:${overlay.id}:`;

      const overlaySources = overlay.sources ?? {};
      for (const id in overlaySources) {
        let source = overlaySources[id]!;

        source = applyVariablesToSource(
          source,
          overlay.variables,
          variables?.[overlay.id],
        );

        this._addedOverlaySources.push(prefix + id);
        this.m.addSource(prefix + id, source);
      }

      for (const layer of overlay.layers ?? []) {
        this._addedOverlayLayers.push(prefix + layer.id);
        this.m.addLayer(rewriteLayer(layer, prefix));
      }
    }
  }

  setLayers(layers: ml.LayerSpecification[]) {
    for (const layer of this._addedLayers) {
      this.m.removeLayer(layer);
    }
    this._addedLayers = [];

    for (const layer of layers) {
      this.m.addLayer(layer);
      this._addedLayers.push(layer.id);
    }
  }

  setGeoJSON(
    geojson: GeoJSON | undefined,
    fit: boolean,
    fitOptions: ml.FitBoundsOptions | undefined,
  ) {
    const src = this.m.getSource<ml.GeoJSONSource>('geojson');
    if (src) {
      if (geojson) {
        src.setData(geojson);

        if (fit) {
          this.m.fitBounds(fitBoundsFor(geojson), fitOptions);
        }
      } else {
        this.m.removeSource('geojson');
      }
    } else {
      if (geojson) {
        this.m.addSource('geojson', { type: 'geojson', data: geojson });
      } else {
        // if we don't have a src and don't want one we don't need to do anything
      }
    }
  }

  private _fetchedImages = new Set<string>();

  private _onStyleImageMissing(evt: ml.MapStyleImageMissingEvent) {
    if (!(evt.id.startsWith('/') || evt.id.startsWith('https://'))) {
      return;
    }
    const id = evt.id;
    let url = id;

    if (this._fetchedImages.has(id)) {
      return;
    }

    let pixelRatio = 1;
    const pixelRatioMatch = id.match(/@((?:[0-9]*[.])?[0-9]+)x/);
    if (pixelRatioMatch !== null) {
      const parsed = parseFloat(pixelRatioMatch[1]!);
      if (isNaN(parsed)) {
        console.warn('invalid pixel ratio expression in ' + id);
      } else {
        pixelRatio = parsed;
      }
    }

    let sdf = false;
    if (url.endsWith('.sdf')) {
      sdf = true;
      url = url.replace(/\.sdf$/, '');
    }

    this._fetchedImages.add(id);

    this.m.loadImage(url).then(
      (img) => {
        this.m.addImage(id, img.data, { sdf, pixelRatio });
      },
      (err) => {
        throw err;
      },
    );
  }

  getCenter(): [number, number] {
    const { lng, lat } = this.m.getCenter();
    return [lng, lat];
  }

  flyIntoView(opts: ml.FlyToOptions, eventData?: unknown) {
    if (opts.center && this.m.getBounds().contains(opts.center)) {
      return;
    }
    this.m.flyTo(opts, eventData);
  }

  setShowFrameRateControl(show: boolean) {
    if (show) {
      if (this._frameRateControl === null) {
        this._frameRateControl = new FrameRateControl();
        this.m.addControl(this._frameRateControl, frameRateControlPosition);
      } else {
        return;
      }
    } else {
      if (this._frameRateControl === null) {
        return;
      } else {
        this.m.removeControl(this._frameRateControl);
        this._frameRateControl = null;
      }
    }
  }

  async resolveDynamicOverlay(
    style: DynamicOverlayStyle,
  ): Promise<OverlayStyle> {
    // the dynamic function is expected to coalesce in-flight requests and cache internally to the extent reasonable.
    const dyn = await style.dynamic();
    return { ...style, ...dyn };
  }

  debugValues(): Record<string, unknown> {
    return {
      baseStyle: this.baseStyle,
      addedOverlaySources: this._addedOverlaySources,
      addedOverlayLayers: this._addedOverlayLayers,
      addedLayers: this._addedLayers,
    };
  }
}

function rewriteLayer(
  layer: ml.LayerSpecification,
  prefix: string,
): ml.LayerSpecification {
  const out = { ...layer };

  out.id = prefix + out.id;

  if ('source' in out) {
    out.source = prefix + out.source;
  }

  return out;
}

export function applyVariablesToSource(
  source: ml.SourceSpecification,
  variableSpec: Record<string, StyleVariableSpec> | undefined,
  variables: Record<string, string> | undefined,
) {
  if (!variableSpec) return source;

  if ('url' in source && typeof source.url === 'string') {
    let url = source.url;
    for (const [variable, spec] of Object.entries(variableSpec)) {
      let value = variables?.[variable];
      if (value === undefined) {
        switch (spec.type) {
          case 'select': {
            if (spec.options.length === 0) continue;
            value = spec.options[0]!.value;
            break;
          }
        }
      }

      url = url.replaceAll('__' + variable + '__', value);
    }
    source = { ...source, url };
  }

  return source;
}

import * as ml from 'maplibre-gl';
import { GeoJSON } from 'geojson';
import { BaseStyle } from '@/features/map/style';
import { fitBoundsFor } from '@/features/map/util';

export type CameraPosition = { lng: number; lat: number; zoom: number };

export type MapManagerInitialView =
  | { at: CameraPosition }
  | { fit: ml.LngLatBoundsLike; options?: ml.FitBoundsOptions };

export class MapManager {
  readonly m: ml.Map;
  readonly baseStyle: BaseStyle;

  private _addedLayers: string[] = [];

  constructor(props: {
    container: HTMLDivElement;
    initialBaseStyle: BaseStyle;
    initialView?: MapManagerInitialView;
  }) {
    this.baseStyle = props.initialBaseStyle;

    const opts: ml.MapOptions = {
      container: props.container,
      style: props.initialBaseStyle.style,
    };

    if (props.initialView && 'at' in props.initialView) {
      opts.center = [props.initialView.at.lng, props.initialView.at.lat];
      opts.zoom = props.initialView.at.zoom;
    } else if (props.initialView && 'fit' in props.initialView) {
      opts.bounds = props.initialView.fit;
      opts.fitBoundsOptions = props.initialView.options;
    }

    this.m = new ml.Map(opts);
  }

  remove() {
    this.m.remove();
  }

  setLayers(layers: ml.LayerSpecification[]) {
    for (const layer of this._addedLayers) {
      this.m.removeLayer(layer);
    }
    this._addedLayers.length = 0;

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
}

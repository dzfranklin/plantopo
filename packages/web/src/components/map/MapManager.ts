import ml from "maplibre-gl";

import { buildStyle } from "./styleBuilder";
import type { MapProps } from "./types";
import { attachZoomSnap } from "./zoomSnap";

export class MapManager {
  private _map: ml.Map | null;
  private _detachZoomSnap: (() => void) | null = null;

  get map(): ml.Map | null {
    return this._map;
  }

  private _lastStyleDeps: unknown[] | undefined;
  private _pendingStyle: ml.StyleSpecification | null = null;
  private _controls: ml.IControl[] = [];
  private _interactive: boolean | undefined = undefined;

  private _onError = (e: ml.ErrorEvent) =>
    console.error("[MapManager]", e.error);

  private _getCameraOptions(): ml.CameraOptions {
    return {
      center: this._map!.getCenter(),
      zoom: this._map!.getZoom(),
      pitch: this._map!.getPitch(),
      bearing: this._map!.getBearing(),
    };
  }

  constructor(container: HTMLDivElement, initialProps: MapProps) {
    const inner = document.createElement("div");
    inner.style.width = "100%";
    inner.style.height = "100%";
    container.appendChild(inner);

    this._map = new ml.Map({
      container: inner,
      style: buildStyle(initialProps),
      interactive: initialProps.interactive ?? false,
      hash: initialProps.hash,
      minZoom: 1, // Otherwise minZoom is fractional, which interacts poorly with our snapping
    });
    this._map.on("error", this._onError);
    this._detachZoomSnap = attachZoomSnap(this._map);
    this._applyInteractive(initialProps.interactive);
  }

  destroy() {
    if (!this._map) return;
    this._detachZoomSnap?.();
    this._detachZoomSnap = null;
    this._map.getContainer().remove();
    if (this._map.loaded()) {
      this._map.remove();
      this._map = null;
    } else {
      this._map.once("load", () => {
        this._map?.remove();
        this._map = null;
      });
    }
  }

  jumpTo(options: ml.CameraOptions) {
    if (!this._map) return;
    if (this._map.isStyleLoaded()) {
      this._map.jumpTo(options);
    } else {
      this._map.once("style.load", () => this._map?.jumpTo(options));
    }
  }

  // Called every React render
  setProps(props: MapProps) {
    if (!this._map) return;

    this._applyInteractive(props.interactive);

    const styleDeps = [props.baseStyle];
    if (
      !this._lastStyleDeps ||
      styleDeps.some((v, i) => v !== this._lastStyleDeps![i])
    ) {
      this._lastStyleDeps = styleDeps;
      const style = buildStyle(props);
      if (this._map.isStyleLoaded()) {
        this._pendingStyle = null;
        const camera = this._getCameraOptions();
        this._map.setStyle(style, { diff: true });
        this._map.once("style.load", () => this._map?.jumpTo(camera));
      } else {
        if (!this._pendingStyle) {
          this._map.once("load", () => {
            if (this._pendingStyle) {
              const camera = this._getCameraOptions();
              this._map?.setStyle(this._pendingStyle, { diff: true });
              this._pendingStyle = null;
              this._map?.once("style.load", () => this._map?.jumpTo(camera));
            }
          });
        }
        this._pendingStyle = style;
      }
    } else if (this._map.loaded()) {
      // Style hasn't changed, just update the GeoJSON data
      const source = this._map.getSource("geojson") as
        | ml.GeoJSONSource
        | undefined;
      if (source) {
        source.setData(
          props.geojson ?? { type: "FeatureCollection", features: [] },
        );
      }
    }
  }

  private _applyInteractive(interactive: boolean | undefined) {
    if (!this._map || interactive === this._interactive) return;
    this._interactive = interactive;

    const method = interactive ? "enable" : "disable";
    this._map.scrollZoom[method]();
    this._map.boxZoom[method]();
    this._map.dragRotate[method]();
    this._map.dragPan[method]();
    this._map.keyboard[method]();
    this._map.doubleClickZoom[method]();
    this._map.touchZoomRotate[method]();
    this._map.touchPitch[method]();

    for (const control of this._controls) {
      this._map.removeControl(control);
    }
    this._controls = [];
    if (interactive) {
      const nav = new ml.NavigationControl();
      const scale = new ml.ScaleControl();
      this._map.addControl(nav);
      this._map.addControl(scale);
      this._controls = [nav, scale];
    }
  }
}

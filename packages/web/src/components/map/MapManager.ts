import ml, { GeolocateControl } from "maplibre-gl";

import { buildStyle } from "./styleBuilder";
import type { MapProps } from "./types";
import { attachZoomSnap } from "./zoomSnap";

export class MapManager {
  private _m: ml.Map | null;
  private _detachZoomSnap: (() => void) | null = null;
  private _lastStyleDeps: unknown[] | undefined;
  private _lastInteractiveDeps: unknown[] | undefined;
  private _lastGeojsonDeps: unknown[] | undefined;
  private _controls: ml.IControl[] = [];
  private _cameraBeforeStyleLoad: ml.CameraOptions | null = null;

  private _onError = (e: ml.ErrorEvent) =>
    console.error("[MapManager]", e.error);

  private _onstyledata = () => {
    if (!this._m) return;
    if (this._cameraBeforeStyleLoad) {
      // TODO: I suspect this is causing a bug. Repro: In dev page enable hash, zoom, click reset. Expected: same camera. Actual: camera zero.
      this._m.jumpTo(this._cameraBeforeStyleLoad);
      this._cameraBeforeStyleLoad = null;
    }
  };

  private _onstyledataloading = () => {
    this._cameraBeforeStyleLoad = this._getCameraOptions();
  };

  private _getCameraOptions(): ml.CameraOptions {
    return {
      center: this._m!.getCenter(),
      zoom: this._m!.getZoom(),
      pitch: this._m!.getPitch(),
      bearing: this._m!.getBearing(),
    };
  }

  constructor(container: HTMLDivElement, initialProps: MapProps) {
    const inner = document.createElement("div");
    inner.style.width = "100%";
    inner.style.height = "100%";
    container.appendChild(inner);

    this._m = new ml.Map({
      container: inner,
      style: buildStyle(initialProps),
      interactive: initialProps.interactive ?? false,
      hash: initialProps.hash,
      minZoom: 1, // Otherwise minZoom is fractional, which interacts poorly with our snapping
      zoomSnap: 1, // Only applies during discrete zoom operations
      pitchWithRotate: false,
      maxPitch: 0, // disable pitch to simplify custom overlays
      boxZoom: false, // Wouldn't work well with our snapping
    });
    this._m.on("error", this._onError);
    this._m.on("styledata", this._onstyledata);
    this._m.on("styledataloading", this._onstyledataloading);
    this._detachZoomSnap = attachZoomSnap(this._m);
    this._applyInteractive(initialProps);
  }

  get map(): ml.Map | null {
    return this._m;
  }

  destroy() {
    if (!this._m) return;
    this._detachZoomSnap?.();
    this._detachZoomSnap = null;
    this._m.getContainer().remove();
    if (this._m.loaded()) {
      this._m.remove();
      this._m = null;
    } else {
      this._m.once("load", () => {
        this._m?.remove();
        this._m = null;
      });
    }
  }

  jumpTo(options: ml.CameraOptions) {
    if (!this._m) return;
    if (this._m.isStyleLoaded()) {
      this._m.jumpTo(options);
    } else {
      this._m.once("style.load", () => this._m?.jumpTo(options));
    }
  }

  // Called every React render
  setProps(props: MapProps) {
    if (!this._m) return;

    const didChangeStyle = this._applyStyle(props);
    this._applyInteractive(props);
    this._applyGeojson(props, didChangeStyle);
  }

  private _applyStyle(props: MapProps): boolean {
    if (!this._m) return false;
    const lastDeps = this._lastStyleDeps;
    const deps = [props.baseStyle];
    this._lastStyleDeps = deps;
    if (this._depsEq(lastDeps, deps)) return false;

    this._lastStyleDeps = deps;
    const style = buildStyle(props);
    this._m.setStyle(style, { diff: !!this._m.isStyleLoaded() });
    return true;
  }

  private _applyInteractive(props: MapProps) {
    if (!this._m) return;
    const lastDeps = this._lastInteractiveDeps;
    const deps = [props.interactive];
    this._lastInteractiveDeps = deps;
    if (this._depsEq(lastDeps, deps)) return;

    const { interactive } = props;

    const method = interactive ? "enable" : "disable";
    this._m.scrollZoom[method]();
    this._m.dragRotate[method]();
    this._m.keyboard[method]();
    this._m.doubleClickZoom[method]();
    this._m.touchZoomRotate[method]();

    for (const control of this._controls) {
      this._m.removeControl(control);
    }
    this._controls = [];
    if (interactive) {
      const nav = new ml.NavigationControl();
      const scale = new ml.ScaleControl();
      const geoloc = new GeolocateControl({
        trackUserLocation: !!window.Native,
      });
      this._m.addControl(nav);
      this._m.addControl(scale);
      this._m.addControl(geoloc);
      this._controls = [nav, scale, geoloc];
    }
  }

  private _applyGeojson(props: MapProps, didChangeStyle: boolean) {
    if (!this._m) return;
    const lastDeps = this._lastGeojsonDeps;
    const deps = [props.geojson];
    this._lastGeojsonDeps = deps;
    if (this._depsEq(lastDeps, deps)) return;

    if (!didChangeStyle) {
      const source = this._m.getSource("geojson") as ml.GeoJSONSource;
      if (source) {
        source.setData(
          props.geojson ?? { type: "FeatureCollection", features: [] },
        );
      }
    }
  }

  private _depsEq(lastDeps: unknown[] | undefined, deps: unknown[]): boolean {
    if (!lastDeps) return false;
    if (lastDeps.length != deps.length) return false;
    for (let i = 0; i < deps.length; i++) {
      if (lastDeps[i] != deps[i]) return false;
    }
    return true;
  }
}

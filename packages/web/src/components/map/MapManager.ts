import ml from "maplibre-gl";

import { BottomInfoControl } from "./BottomInfoControl";
import { TerrainControl } from "./TerrainControl";
import type { MapProps } from "./types";
import { attachZoomSnap } from "./zoomSnap";

export class MapManager {
  static trace = false;
  static _nextTraceID = 1;

  traceID = MapManager._nextTraceID++;

  private _m: ml.Map | null;
  private _detachZoomSnap: (() => void) | null = null;
  private _controls: ml.IControl[] = [];
  private _bottomInfoControl: BottomInfoControl | null = null;
  private _deferredProps: MapProps | null = null;

  private _lastStyleDeps: unknown[] | undefined;
  private _lastInteractiveDeps: unknown[] | undefined;
  private _lastGeojsonDeps: unknown[] | undefined;
  private _lastOnManagerDeps: unknown[] | undefined;

  private _onError = (e: ml.ErrorEvent) =>
    console.error("[MapManager]", e.error);

  private _onstyleload = () => {
    if (!this._m) return;
    const checkForStyleLoad = () => {
      if (!this._m) return;
      if (this._m.isStyleLoaded()) {
        clearInterval(checkInterval);
        this._m.fire("plantopo:stylechange");
      }
    };
    const checkInterval = setInterval(checkForStyleLoad, 100);
  };

  private _onstylechange = () => {
    this._trace();
    if (this._deferredProps) {
      const props = this._deferredProps;
      this._deferredProps = null;
      this.setProps(props);
    }
  };

  constructor(
    {
      container,
      onDisplayFullAttribution,
    }: {
      container: HTMLDivElement;
      onDisplayFullAttribution?: (html: string) => void;
    },
    initialProps: MapProps,
  ) {
    this._trace({ initialProps });
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
      boxZoom: false, // Wouldn't work well with our snapping
      attributionControl: false, // in our BottomInfoControl
    });

    this._bottomInfoControl = new BottomInfoControl(
      initialProps.distanceUnit,
      onDisplayFullAttribution,
    );
    this._m.addControl(this._bottomInfoControl);

    this._m.on("error", this._onError);
    this._m.on("style.load", this._onstyleload);
    this._m.on("plantopo:stylechange", this._onstylechange);

    this._detachZoomSnap = attachZoomSnap(this._m);
    this._applyInteractive(initialProps);

    this._deferredProps = initialProps;
  }

  get map(): ml.Map | null {
    return this._m;
  }

  destroy() {
    if (!this._m) return;

    const m = this._m;
    this._m = null;

    this._detachZoomSnap?.();
    this._detachZoomSnap = null;
    this._bottomInfoControl = null;

    m.getContainer().remove();

    const removeMap = () => {
      const hash = location.hash;

      m.remove?.();

      // maplibre restores the hash on remove, which we don't want
      if (location.hash !== hash) {
        const url = location.pathname + location.search + hash;
        history.replaceState(null, "", url);
      }
    };

    if (m.loaded()) removeMap();
    else m.once("load", () => removeMap());
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
    this._trace({ props });
    if (!this._m) return;

    if (this._m.isStyleLoaded()) {
      this._deferredProps = null;
    } else {
      this._deferredProps = props;
    }

    const didChangeStyle = this._applyStyle(props);
    this._applyInteractive(props);
    this._applyGeojson(props, didChangeStyle);
    this._bottomInfoControl!.setDistanceUnit(props.distanceUnit);

    this._applyOnManager(props); // after all other updates
  }

  private _applyStyle(props: MapProps): boolean {
    if (!this._m) return false;
    const lastDeps = this._lastStyleDeps;
    const deps = [props.style];
    this._lastStyleDeps = deps;
    if (this._depsEq(lastDeps, deps)) return false;
    this._trace("applying");

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
    this._trace("applying", { interactive: props.interactive });

    const interactive = props.interactive ?? true;

    const method = interactive ? "enable" : "disable";
    this._m.scrollZoom[method]();
    this._m.dragRotate[method]();
    this._m.dragPan[method]();
    this._m.keyboard[method]();
    this._m.doubleClickZoom[method]();
    this._m.touchZoomRotate[method]();

    for (const control of this._controls) {
      this._m.removeControl(control);
    }
    this._controls = [];
    if (interactive) {
      const nav = new ml.NavigationControl();
      const geoloc = new ml.GeolocateControl({
        trackUserLocation: !!window.Native,
      });
      const terrain = new TerrainControl({
        source: "plantopo:terrain-dem",
        exaggeration: 1,
      });
      this._m.addControl(nav, "top-right");
      this._m.addControl(geoloc, "top-right");
      this._m.addControl(terrain, "top-right");
      this._controls = [nav, geoloc, terrain];
    }
  }

  private _applyGeojson({ geojson }: MapProps, didChangeStyle: boolean) {
    if (!this._m) return;
    const lastDeps = this._lastGeojsonDeps;
    const deps = [geojson, didChangeStyle];
    this._lastGeojsonDeps = deps;
    if (this._depsEq(lastDeps, deps)) return;
    this._trace("applying", { geojson, didChangeStyle });

    const source = this._m.getSource("plantopo:geojson") as
      | ml.GeoJSONSource
      | undefined;
    if (!source) return;
    source.setData(geojson ?? { type: "FeatureCollection", features: [] });
  }

  private _applyOnManager(props: MapProps) {
    const lastDeps = this._lastOnManagerDeps;
    const deps = [props.onManager];
    this._lastOnManagerDeps = deps;
    if (this._depsEq(lastDeps, deps)) return;
    this._trace("applying", { onManager: props.onManager });
    props.onManager?.(this);
  }

  private _depsEq(lastDeps: unknown[] | undefined, deps: unknown[]): boolean {
    if (!lastDeps) return false;
    if (lastDeps.length != deps.length) return false;
    for (let i = 0; i < deps.length; i++) {
      if (lastDeps[i] != deps[i]) return false;
    }
    return true;
  }

  private _trace(arg1?: string | object, arg2?: object) {
    if (MapManager.trace) {
      const dummyError = new Error();
      let position = "";
      if (dummyError.stack) {
        const stack = dummyError.stack
          .split("\n")
          .map(l => l.trim())
          .map(l => l.replace("MapManager.", "."))
          .map(l => l.match(/at (.+) \(/)?.[1] ?? l)
          .slice(2);
        position = stack.slice(0, 3).reverse().join(" > ");
      }

      const msg = typeof arg1 === "string" ? arg1 : null;
      const data = typeof arg1 === "string" ? arg2 : arg1;

      console.groupCollapsed(
        `[MapManager ${this.traceID} ${position}]${msg ? " " + msg : ""}${data ? " (" + Object.keys(data).join(", ") + "...)" : ""}`,
      );
      if (data) {
        for (const [key, value] of Object.entries(data)) {
          console.log(`${key}\n`, value);
        }
      }
      console.trace();
      console.groupEnd();
    }
  }
}

function buildStyle(props: MapProps): ml.StyleSpecification {
  return props.style
    ? props.style
    : {
        version: 8,
        sources: {},
        layers: [],
      };
}

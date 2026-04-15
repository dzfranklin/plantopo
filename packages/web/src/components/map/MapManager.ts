import ml, { setWorkerUrl } from "maplibre-gl";
import maplibreWorkerUrl from "maplibre-gl/dist/maplibre-gl-csp-worker.js?url";

import { BottomInfoControl } from "./BottomInfoControl";
import { InteractionManager } from "./interaction/InteractionManager";
import type { MapProps } from "./types";

setWorkerUrl(maplibreWorkerUrl);

const TERRAIN_SOURCE = "plantopo:terrain-dem";
const TERRAIN_OPTIONS: ml.TerrainSpecification = {
  source: TERRAIN_SOURCE,
  exaggeration: 1,
};

export class MapManager {
  static trace = false;
  static _nextTraceID = 1;

  traceID = MapManager._nextTraceID++;

  private _m: ml.Map | null;
  private _bottomInfoControl: BottomInfoControl | null = null;
  private _im: InteractionManager | null = null;
  private _deferredProps: MapProps | null = null;
  onCameraChangeIdle: (() => void) | undefined;
  private _cameraChanged = false;

  private _lastStyleDeps: unknown[] | undefined;
  private _lastInteractiveDeps: unknown[] | undefined;
  private _lastGeojsonDeps: unknown[] | undefined;

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

    let initialCamera: ml.CameraOptions = {};
    if (typeof initialProps.initialCamera === "string") {
      initialCamera = MapManager.deserializeCamera(initialProps.initialCamera);
    } else if (initialProps.initialCamera) {
      initialCamera = initialProps.initialCamera;
    }

    this._m = new ml.Map({
      container: inner,
      style: buildStyle(initialProps),
      interactive: initialProps.interactive ?? false,
      hash: initialProps.hash ? "c" : false,
      minZoom: 1,
      boxZoom: false,
      attributionControl: false, // in our BottomInfoControl
      zoomSnap: 1, // controls discrete ops (map.zoomIn/Out, keyboard) — gesture snap is handled by InteractionManager
      ...initialCamera,
    });

    this._bottomInfoControl = new BottomInfoControl(
      initialProps.distanceUnit,
      onDisplayFullAttribution,
    );
    this._m.addControl(this._bottomInfoControl);

    this._m.on("error", this._onError);
    this._m.on("style.load", this._onstyleload);
    this._m.on("plantopo:stylechange", this._onstylechange);

    this._m.on("move", () => {
      this._cameraChanged = true;
    });
    this._m.on("idle", () => {
      if (this._cameraChanged) {
        this._cameraChanged = false;
        this.onCameraChangeIdle?.();
      }
    });

    // Disable MapLibre's built-in interaction handlers — InteractionManager owns all gestures
    this._m.scrollZoom.disable();
    this._m.dragRotate.disable();
    this._m.dragPan.disable();
    this._m.keyboard.disable();
    this._m.doubleClickZoom.disable();
    this._m.touchZoomRotate.disable();
    this._m.touchPitch?.disable();

    this._applyInteractive(initialProps);

    this._deferredProps = initialProps;
  }

  get map(): ml.Map | null {
    return this._m;
  }

  get interactionManager(): InteractionManager | null {
    return this._im;
  }

  destroy() {
    if (!this._m) return;

    const m = this._m;
    this._m = null;

    this._im?.destroy();
    this._im = null;
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

  on<T extends keyof ml.MapEventType>(
    type: T,
    listener: (ev: ml.MapEventType[T] & object) => void,
  ): ml.Subscription {
    if (this._m) {
      return this._m.on(type, listener);
    } else {
      console.warn(
        "Attempted to add map event listener after map was destroyed",
      );
      return { unsubscribe: () => {} };
    }
  }

  getCamera(): ml.CameraOptions {
    if (!this._m) throw new Error("MapManager destroyed");
    return {
      center: this._m.getCenter(),
      zoom: this._m.getZoom(),
      bearing: this._m.getBearing(),
      pitch: this._m.getPitch(),
    };
  }

  serializeCamera(camera?: ml.CameraOptions): string {
    const c = camera ?? (this._m ? this.getCamera() : null);
    if (!c) return "";
    // Based on <https://github.com/maplibre/maplibre-gl-js/blob/8584c2e766b8a3d54023450dbef8aeee91b99762/src/ui/hash.ts#L45>
    const center = ml.LngLat.convert(c.center as ml.LngLatLike),
      zoom = Math.round((c.zoom ?? 0) * 100) / 100,
      // derived from equation: 512px * 2^z / 360 / 10^d < 0.5px
      precision = Math.ceil(
        (zoom * Math.LN2 + Math.log(512 / 360 / 0.5)) / Math.LN10,
      ),
      m = Math.pow(10, precision),
      lng = Math.round(center.lng * m) / m,
      lat = Math.round(center.lat * m) / m,
      bearing = c.bearing ?? 0,
      pitch = c.pitch ?? 0;
    let hash = `${zoom}/${lat}/${lng}`;
    if (bearing || pitch) hash += `/${Math.round((bearing ?? 0) * 10) / 10}`;
    if (pitch) hash += `/${Math.round(pitch)}`;
    return hash;
  }

  static deserializeCamera(hash: string): ml.CameraOptions {
    const parts = hash.split("/");
    if (parts.length < 3) return {};
    const [zoomStr, latStr, lngStr, bearingStr, pitchStr] = parts;
    const zoom = parseFloat(zoomStr!);
    const lat = parseFloat(latStr!);
    const lng = parseFloat(lngStr!);
    if (isNaN(zoom) || isNaN(lat) || isNaN(lng)) return {};
    const options: ml.CameraOptions = {
      zoom,
      center: [lng, lat],
    };
    if (bearingStr) {
      const bearing = parseFloat(bearingStr);
      if (!isNaN(bearing)) options.bearing = bearing;
    }
    if (pitchStr) {
      const pitch = parseFloat(pitchStr);
      if (!isNaN(pitch)) options.pitch = pitch;
    }
    return options;
  }

  // Called every React render
  setProps(props: MapProps) {
    this._trace({ props });
    if (!this._m) return;

    if (this._loaded()) {
      this._deferredProps = null;
    } else {
      this._deferredProps = props;
    }

    const didChangeStyle = this._applyStyle(props);
    this._applyInteractive(props);
    this._applyGeojson(props, didChangeStyle);
    this._bottomInfoControl!.setDistanceUnit(props.distanceUnit);
  }

  private _applyStyle(props: MapProps): boolean {
    if (!this._m) return false;
    const lastDeps = this._lastStyleDeps;
    const deps = [props.style, props.terrain];
    this._lastStyleDeps = deps;
    if (this._depsEq(lastDeps, deps)) return false;
    this._trace("applying");

    this._m.setStyle(buildStyle(props), { diff: this._loaded() });

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

    if (interactive && !this._im) {
      this._im = new InteractionManager(this._m);
    } else if (!interactive && this._im) {
      this._im.destroy();
      this._im = null;
    }

    // Controls are rendered as React components in MapControls
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

  private _depsEq(lastDeps: unknown[] | undefined, deps: unknown[]): boolean {
    if (!lastDeps) return false;
    if (lastDeps.length != deps.length) return false;
    for (let i = 0; i < deps.length; i++) {
      if (lastDeps[i] != deps[i]) return false;
    }
    return true;
  }

  private _loaded() {
    return this._m?._loaded ?? false;
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
  const base: ml.StyleSpecification = props.style ?? {
    version: 8,
    sources: {},
    layers: [],
  };
  const hasTerrainSource = TERRAIN_SOURCE in (base.sources ?? {});
  const terrain =
    props.terrain && hasTerrainSource ? TERRAIN_OPTIONS : undefined;
  return { ...base, terrain };
}

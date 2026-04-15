// Vendored and adapted from maplibre-gl's GeolocateControl
// <https://github.com/maplibre/maplibre-gl-js/blob/48caed8321a8e90b4579f37a08219df2c4e590ae/src/ui/control/geolocate_control.ts>
// DOM manipulation removed; state changes surfaced via onStateChange callback.
import ml from "maplibre-gl";

export type GeolocateWatchState =
  | "OFF"
  | "WAITING_ACTIVE"
  | "ACTIVE_LOCK"
  | "ACTIVE_ERROR"
  | "BACKGROUND"
  | "BACKGROUND_ERROR";

export type GeolocateState = {
  watchState: GeolocateWatchState;
  supported: boolean;
};

const DEFAULT_POSITION_OPTIONS: PositionOptions = {
  enableHighAccuracy: false,
  maximumAge: 0,
  timeout: 6000,
};

const FIT_BOUNDS_OPTIONS: ml.FitBoundsOptions = { maxZoom: 15 };

let numberOfWatches = 0;
let noTimeout = false;

export class GeolocateStateMachine {
  onStateChange: (state: GeolocateState) => void;

  private _map: ml.Map;
  private _watchState: GeolocateWatchState = "OFF";
  private _supported = false;
  private _setup = false;
  private _geolocationWatchID: number | undefined;
  private _timeoutId: ReturnType<typeof setTimeout> | undefined;
  private _lastKnownPosition: GeolocationPosition | null = null;
  private _userLocationDotMarker: ml.Marker;
  private _accuracyCircleMarker: ml.Marker;
  private _accuracy = 0;

  constructor(map: ml.Map, onStateChange: (state: GeolocateState) => void) {
    this._map = map;
    this.onStateChange = onStateChange;

    const dotElement = document.createElement("div");
    dotElement.className = "maplibregl-user-location-dot";
    this._userLocationDotMarker = new ml.Marker({ element: dotElement });

    const circleElement = document.createElement("div");
    circleElement.className = "maplibregl-user-location-accuracy-circle";
    this._accuracyCircleMarker = new ml.Marker({
      element: circleElement,
      pitchAlignment: "map",
    });

    this._map.on("zoom", this._onUpdate);
    this._map.on("move", this._onUpdate);
    this._map.on("rotate", this._onUpdate);
    this._map.on("pitch", this._onUpdate);
    this._map.on("movestart", this._onMoveStart);

    checkGeolocationSupport().then(supported => {
      this._supported = supported;
      this._setup = true;
      this._emit();
    });
  }

  destroy() {
    if (this._geolocationWatchID !== undefined) {
      navigator.geolocation.clearWatch(this._geolocationWatchID);
      this._geolocationWatchID = undefined;
    }
    this._userLocationDotMarker.remove();
    this._accuracyCircleMarker.remove();
    this._map.off("zoom", this._onUpdate);
    this._map.off("move", this._onUpdate);
    this._map.off("rotate", this._onUpdate);
    this._map.off("pitch", this._onUpdate);
    this._map.off("movestart", this._onMoveStart);
  }

  get watchState(): GeolocateWatchState {
    return this._watchState;
  }

  get supported(): boolean {
    return this._supported;
  }

  trigger(): boolean {
    if (!this._setup) return false;

    // Outgoing state cleanup
    switch (this._watchState) {
      case "OFF":
        this._watchState = "WAITING_ACTIVE";
        break;
      case "WAITING_ACTIVE":
      case "ACTIVE_LOCK":
      case "ACTIVE_ERROR":
      case "BACKGROUND_ERROR":
        numberOfWatches--;
        noTimeout = false;
        this._watchState = "OFF";
        this._clearWatch();
        this._emit();
        return true;
      case "BACKGROUND":
        this._watchState = "ACTIVE_LOCK";
        if (this._lastKnownPosition)
          this._updateCamera(this._lastKnownPosition);
        this._emit();
        return true;
      default:
        throw new Error(`Unexpected watchState ${this._watchState}`);
    }

    // Incoming: WAITING_ACTIVE — start watching
    if (this._geolocationWatchID === undefined) {
      numberOfWatches++;
      let positionOptions: PositionOptions;
      if (numberOfWatches > 1) {
        positionOptions = { maximumAge: 600000, timeout: 0 };
        noTimeout = true;
      } else {
        positionOptions = DEFAULT_POSITION_OPTIONS;
        noTimeout = false;
      }
      this._geolocationWatchID = navigator.geolocation.watchPosition(
        this._onSuccess,
        this._onError,
        positionOptions,
      );
    }

    this._emit();
    return true;
  }

  private _emit() {
    this.onStateChange({
      watchState: this._watchState,
      supported: this._supported,
    });
  }

  private _onSuccess = (position: GeolocationPosition) => {
    if (!this._map) return;

    if (this._isOutOfMapMaxBounds(position)) {
      this._setErrorState();
      this._updateMarker(null);
      this._finish();
      this._emit();
      return;
    }

    this._lastKnownPosition = position;

    switch (this._watchState) {
      case "WAITING_ACTIVE":
      case "ACTIVE_LOCK":
      case "ACTIVE_ERROR":
        this._watchState = "ACTIVE_LOCK";
        break;
      case "BACKGROUND":
      case "BACKGROUND_ERROR":
        this._watchState = "BACKGROUND";
        break;
      default:
        throw new Error(`Unexpected watchState ${this._watchState}`);
    }

    this._updateMarker(position);
    if (this._watchState === "ACTIVE_LOCK") this._updateCamera(position);

    this._finish();
    this._emit();
  };

  private _onError = (error: GeolocationPositionError) => {
    if (!this._map) return;

    if (error.code === 1 /* PERMISSION_DENIED */) {
      this._watchState = "OFF";
      this._supported = false;
      if (this._geolocationWatchID !== undefined) this._clearWatch();
    } else if (error.code === 3 && noTimeout) {
      // forced timeout to get fresh position — not a real error
      return;
    } else {
      this._setErrorState();
    }

    this._userLocationDotMarker
      .getElement()
      .classList.add("maplibregl-user-location-dot-stale");

    this._finish();
    this._emit();
  };

  private _onMoveStart = (
    event: ml.MapLibreEvent & { geolocateSource?: boolean },
  ) => {
    if (
      !event.geolocateSource &&
      this._watchState === "ACTIVE_LOCK" &&
      !this._map.isZooming()
    ) {
      this._watchState = "BACKGROUND";
      this._emit();
    }
  };

  private _onUpdate = () => {
    this._updateCircleRadius();
  };

  private _setErrorState() {
    switch (this._watchState) {
      case "WAITING_ACTIVE":
      case "ACTIVE_LOCK":
      case "ACTIVE_ERROR":
        this._watchState = "ACTIVE_ERROR";
        break;
      case "BACKGROUND":
      case "BACKGROUND_ERROR":
        this._watchState = "BACKGROUND_ERROR";
        break;
      case "OFF":
        break;
      default:
        throw new Error(`Unexpected watchState ${this._watchState}`);
    }
  }

  private _isOutOfMapMaxBounds(position: GeolocationPosition): boolean {
    const bounds = this._map.getMaxBounds();
    if (!bounds) return false;
    const { longitude, latitude } = position.coords;
    return (
      longitude < bounds.getWest() ||
      longitude > bounds.getEast() ||
      latitude < bounds.getSouth() ||
      latitude > bounds.getNorth()
    );
  }

  private _updateCamera(position: GeolocationPosition) {
    const center = new ml.LngLat(
      position.coords.longitude,
      position.coords.latitude,
    );
    const bearing = this._map.getBearing();
    const newBounds = ml.LngLatBounds.fromLngLat(
      center,
      position.coords.accuracy,
    );
    this._map.fitBounds(newBounds, { bearing, ...FIT_BOUNDS_OPTIONS }, {
      geolocateSource: true,
    } as ml.AnimationOptions);
  }

  private _updateMarker(position: GeolocationPosition | null) {
    if (position) {
      const center = new ml.LngLat(
        position.coords.longitude,
        position.coords.latitude,
      );
      this._accuracyCircleMarker.setLngLat(center).addTo(this._map);
      this._userLocationDotMarker.setLngLat(center).addTo(this._map);
      this._accuracy = position.coords.accuracy;
      this._updateCircleRadius();
    } else {
      this._userLocationDotMarker.remove();
      this._accuracyCircleMarker.remove();
    }
  }

  private _updateCircleRadius() {
    const userLocation = this._userLocationDotMarker.getLngLat();
    if (!this._accuracy || !userLocation) return;
    const screenPosition = this._map.project(userLocation);
    const userLocationWith100Px = this._map.unproject([
      screenPosition.x + 100,
      screenPosition.y,
    ]);
    const pixelsToMeters = userLocation.distanceTo(userLocationWith100Px) / 100;
    const circleDiameter = (2 * this._accuracy) / pixelsToMeters;
    const el = this._accuracyCircleMarker.getElement();
    el.style.width = `${circleDiameter.toFixed(2)}px`;
    el.style.height = `${circleDiameter.toFixed(2)}px`;
  }

  private _finish() {
    if (this._timeoutId) clearTimeout(this._timeoutId);
    this._timeoutId = undefined;
  }

  private _clearWatch() {
    if (this._geolocationWatchID !== undefined) {
      navigator.geolocation.clearWatch(this._geolocationWatchID);
      this._geolocationWatchID = undefined;
    }
    this._updateMarker(null);
  }
}

async function checkGeolocationSupport(): Promise<boolean> {
  if (!navigator.geolocation) return false;
  if (!navigator.permissions) return true;
  try {
    const result = await navigator.permissions.query({ name: "geolocation" });
    return result.state !== "denied";
  } catch {
    return true;
  }
}

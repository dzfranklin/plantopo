import Point from "@mapbox/point-geometry";
import type ml from "maplibre-gl";

import type { Handler, HandlerResult } from "../handler";

export class DoubleClickZoomHandler implements Handler {
  _map: ml.Map;
  _enabled: boolean = false;
  _active: boolean = false;

  constructor(map: ml.Map) {
    this._map = map;
    this.reset();
  }

  reset() {
    this._active = false;
  }

  dblclick(e: MouseEvent, point: Point): HandlerResult | void {
    if (!this.isEnabled()) return;
    e.preventDefault();
    return {
      cameraAnimation: (map: ml.Map) => {
        map.easeTo(
          {
            duration: 300,
            zoom: map.getZoom() + (e.shiftKey ? -1 : 1),
            around: map.unproject(point),
          },
          { originalEvent: e },
        );
      },
    };
  }

  enable() {
    this._enabled = true;
  }
  disable() {
    this._enabled = false;
    this.reset();
  }
  isEnabled() {
    return this._enabled;
  }
  isActive() {
    return this._active;
  }
}

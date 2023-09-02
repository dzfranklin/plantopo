import type * as ml from 'maplibre-gl';

export interface CameraBBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export class CurrentCameraPosition {
  private constructor(
    public center: [number, number],
    public zoom: number,
    public bearing: number,
    public pitch: number,
    public bbox: CameraBBox,
    private _map: ml.Map, // Hack: So we can use for projection
  ) {}

  static fromMap(map: ml.Map): CurrentCameraPosition {
    const center = map.getCenter();
    const bounds = map.getBounds();
    return new CurrentCameraPosition(
      [center.lng, center.lat],
      map.getZoom(),
      map.getBearing(),
      map.getPitch(),
      {
        minY: bounds.getNorth(),
        maxY: bounds.getSouth(),
        minX: bounds.getEast(),
        maxX: bounds.getWest(),
      },
      map,
    );
  }

  // Hack: I should use https://github.com/proj4js/proj4js instead of keeping a
  // ref to map so it doesn't have to be just the current camera we can project
  // in. But remember we need to account for pitch and bearing

  project(lnglat: [number, number] | GeoJSON.Position): [number, number] {
    if (lnglat.length < 2) {
      // GeoJSON.Position must be length 2 or 3
      throw new Error('not a lnglat');
    }
    const pt = this._map.project([lnglat[0], lnglat[1]]);
    return [pt.x, pt.y];
  }

  unproject(xy: [number, number]): [number, number] {
    const lnglat = this._map.unproject(xy);
    return [lnglat.lng, lnglat.lat];
  }
}

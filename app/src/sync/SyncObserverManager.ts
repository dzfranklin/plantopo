import { SyncEngine } from './SyncEngine';

type GeoRoot = GeoJSON.FeatureCollection<GeoJSON.Geometry | null>;

/**
 * This interface is designed to drive the maplibre
 * API.
 */
export interface LayersObserver {
  /**
   * Insert `lid` before `after`.
   */
  addLayer(props: Map<string, unknown>, after: number | undefined): void;
  removeLayer(lid: number): void;
  /**
   * Move `lid` before `after`.
   */
  moveLayer(lid: number, after: number | undefined): void;
  setProp(lid: number, k: string, v: unknown): void;
}

export class SyncObserverManager {
  private featurePropObservers: Map<
    [number, string],
    Set<(_: unknown) => void>
  > = new Map();

  private batchGeoChange: 'unchanged' | 'changed' | null = null;

  private geoObservers: Set<(_: GeoRoot) => void> = new Set();

  private layersObservers: Set<LayersObserver> = new Set();
  private layerOrderObservers: Set<(_: Array<number>) => void> = new Set();
  private layerPropObservers: Map<[number, string], Set<(_: unknown) => void>> =
    new Map();

  private engine: SyncEngine;

  constructor(engine: SyncEngine) {
    this.engine = engine;
  }

  startBatchGeoChange(): void {
    this.batchGeoChange = 'unchanged';
  }

  markGeoDidChange(): void {
    switch (this.batchGeoChange) {
      case 'unchanged':
        this.batchGeoChange = 'changed';
        break;
      case 'changed':
        break;
      case null:
        throw new Error(
          'markBatchGeoChange() called before startBatchGeoChange()',
        );
    }
  }

  endBatchGeoChange(): void {
    if (this.batchGeoChange === 'changed') {
      for (const cb of this.geoObservers) {
        cb(this.engine.geoRoot);
      }
    }
    this.batchGeoChange = null;
  }

  observeGeo(cb: (_: GeoRoot) => void): void {
    this.geoObservers.add(cb);
    cb(this.engine.geoRoot);
  }

  unobserveGeo(cb: (_: GeoRoot) => void): void {
    this.geoObservers.delete(cb);
  }

  observeFeatureProp(
    fid: number,
    key: string,
    cb: (value: unknown) => void,
  ): void {
    let observers = this.featurePropObservers.get([fid, key]);
    if (!observers) {
      observers = new Set();
      this.featurePropObservers.set([fid, key], observers);
    }
    observers.add(cb);

    const currentValue = this.engine.features.get(fid)?.get(key);
    cb(currentValue);
  }

  unobserveFeatureProp(
    fid: number,
    key: string,
    cb: (value: unknown) => void,
  ): void {
    this.featurePropObservers.get([fid, key])?.delete(cb);
  }

  /**
   * The first layer in `order` appears beneath the other layers on the map, but
   * should probably appear at the top of the layer control.
   */
  observeLayerOrder(cb: (order: Array<number>) => void): void {
    this.layerOrderObservers.add(cb);
  }

  unobserveLayerOrder(cb: (order: Array<number>) => void): void {
    this.layerOrderObservers.delete(cb);
  }

  observeLayers(cb: LayersObserver): void {
    this.layersObservers.add(cb);
  }

  unobserveLayers(cb: LayersObserver): void {
    this.layersObservers.delete(cb);
  }

  observeLayerProp(
    lid: number,
    key: string,
    cb: (value: unknown) => void,
  ): void {
    let observers = this.featurePropObservers.get([lid, key]);
    if (!observers) {
      observers = new Set();
      this.layerPropObservers.set([lid, key], observers);
    }
    observers.add(cb);

    const currentValue = this.engine.layers.get(lid)?.get(key);
    cb(currentValue);
  }

  unobserveLayerProp(
    lid: number,
    key: string,
    cb: (value: unknown) => void,
  ): void {
    this.layerPropObservers.get([lid, key])?.delete(cb);
  }

  callFeaturePropObservers(fid: number, key: string, value: unknown): void {
    const listeners = this.featurePropObservers.get([fid, key]);
    if (listeners) {
      for (const listener of listeners) {
        listener(value);
      }
    }
  }

  callLayerPropObservers(lid: number, key: string, value: unknown): void {
    const listeners = this.layerPropObservers.get([lid, key]);
    if (listeners) {
      for (const listener of listeners) {
        listener(value);
      }
    }
  }

  callLayerOrderObservers(): void {
    const order = this.engine.layerOrder();
    for (const obs of this.layerOrderObservers) {
      obs(order);
    }
  }

  callLayersObservers(f: (_: LayersObserver) => void): void {
    for (const obs of this.layersObservers) {
      f(obs);
    }
  }
}

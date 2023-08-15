import { SyncChange } from './SyncChange';
import { SyncOp } from './SyncOp';

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

export interface FeatureTreeNode {
  id: number;
  idx: string;
  ancestors: Array<number>;
  children: Array<FeatureTreeNode>;
}

export class SyncEngine {
  /** Updated by mutation */
  features: Map<number, Map<string, unknown>> = new Map();

  /** Updated by mutation */
  layers: Map<number, Map<string, unknown>> = new Map();

  /** Updated by mutation */
  geoRoot: GeoRoot = {
    type: 'FeatureCollection',
    features: [],
  };

  /** Updated by reassignment */
  featureTree: FeatureTreeNode = {
    id: 0,
    idx: '',
    ancestors: [],
    children: [],
  };

  private _layerOrder: Array<{ lid: number; idx: string }> = [];

  /** Skip to a feature in `geoRoot` */
  private _featureGeo: Map<number, GeoJSON.Feature<GeoJSON.Geometry | null>> =
    new Map();

  /** Skip to a node in `featureTree` */
  private _treeFeature: Map<number, FeatureTreeNode> = new Map();

  // Observers

  private _featurePropObservers: Map<
    [number, string],
    Set<(_: unknown) => void>
  > = new Map();

  private _batchGeoChange: 'unchanged' | 'changed' | null = null;

  private _geoObservers: Set<(_: GeoRoot) => void> = new Set();

  private _layersObservers: Set<LayersObserver> = new Set();
  private _layerOrderObservers: Set<(_: Array<number>) => void> = new Set();
  private _layerPropObservers: Map<
    [number, string],
    Set<(_: unknown) => void>
  > = new Map();

  layerOrder(): Array<number> {
    return this._layerOrder.map(({ lid }) => lid);
  }

  apply(op: SyncOp): void {
    this._startBatchGeoChange();
    switch (op.action) {
      case 'createFeature': {
        this._featureSet(op.id, 'pos', op.pos);
        this._featureSet(op.id, 'type', op.type);
        break;
      }
      case 'deleteFeature': {
        this.features.delete(op.id);
        break;
      }
      case 'featureSet': {
        this._featureSet(op.id, op.key, op.value);
      }
      case 'layerSet': {
        this.layerSet(op.id, op.key, op.value);
      }
    }
    this._endBatchGeoChange();
  }

  change(change: SyncChange): void {
    this._startBatchGeoChange();
    for (const [fid, k, v] of change.featureProps) {
      this._featureSet(fid, k, v);
    }
    for (const [lid, k, v] of change.layerProps) {
      this.layerSet(lid, k, v);
    }
    for (const fid of change.deletedFeatures) {
      this.features.delete(fid);
    }
    this._endBatchGeoChange();
  }

  moveFeatures(
    features: number[],
    parent: number,
    before: number | undefined,
    after: number | undefined,
  ): void {
    const orderedFeatures = this.orderFeatures(features);

    throw new Error('todo');
  }

  orderFeatures(features: Array<number>): Array<number> {
    const weighted = new Map<number, string[]>();
    for (const feature of features) {
      if (weighted.has(feature)) continue;

      let ancestors = this._treeFeature.get(feature)?.ancestors;
      if (ancestors === undefined || ancestors.length === 0) {
        console.warn(`orderFeatures: no ancestors for fid ${feature}`);
        ancestors = [1];
      }

      let weight = [];
      for (const ancestor of ancestors) {
        const idx = this._treeFeature.get(ancestor)?.idx;
        if (idx === undefined) {
          console.warn(`orderFeatures: no record for ancestor fid ${ancestor}`);
          weight = ['x'];
          break;
        }

        weight.push(idx);
      }

      weighted.set(feature, weight);
    }

    return Array.from(weighted.entries())
      .sort(([fidA, weightA], [fidB, weightB]) => {
        for (let i = 0; i < Math.min(weightA.length, weightB.length); i++) {
          if (weightA[i] < weightB[i]) {
            return -1;
          }
          if (weightA[i] > weightB[i]) {
            return 1;
          }
        }

        if (weightA.length < weightB.length) {
          return -1;
        } else if (weightA.length > weightB.length) {
          return 1;
        }

        // Break ties with id
        if (fidA < fidB) {
          return -1;
        } else if (fidA > fidB) {
          return 1;
        } else {
          console.error(
            'orderFeatures: duplicated fids in sort should be impossible',
          );
          return 0;
        }
      })
      .map(([fid, _weight]) => fid);
  }

  // Observers

  observeGeo(cb: (_: GeoRoot) => void): void {
    this._geoObservers.add(cb);
    cb(this.geoRoot);
  }

  unobserveGeo(cb: (_: GeoRoot) => void): void {
    this._geoObservers.delete(cb);
  }

  observeFeatureProp(
    fid: number,
    key: string,
    cb: (value: unknown) => void,
  ): void {
    let observers = this._featurePropObservers.get([fid, key]);
    if (!observers) {
      observers = new Set();
      this._featurePropObservers.set([fid, key], observers);
    }
    observers.add(cb);

    const currentValue = this.features.get(fid)?.get(key);
    cb(currentValue);
  }

  unobserveFeatureProp(
    fid: number,
    key: string,
    cb: (value: unknown) => void,
  ): void {
    this._featurePropObservers.get([fid, key])?.delete(cb);
  }

  /**
   * The first layer in `order` appears beneath the other layers on the map, but
   * should probably appear at the top of the layer control.
   */
  observeLayerOrder(cb: (order: Array<number>) => void): void {
    this._layerOrderObservers.add(cb);
  }

  unobserveLayerOrder(cb: (order: Array<number>) => void): void {
    this._layerOrderObservers.delete(cb);
  }

  observeLayers(cb: LayersObserver): void {
    this._layersObservers.add(cb);
  }

  unobserveLayers(cb: LayersObserver): void {
    this._layersObservers.delete(cb);
  }

  observeLayerProp(
    lid: number,
    key: string,
    cb: (value: unknown) => void,
  ): void {
    let observers = this._featurePropObservers.get([lid, key]);
    if (!observers) {
      observers = new Set();
      this._layerPropObservers.set([lid, key], observers);
    }
    observers.add(cb);

    const currentValue = this.layers.get(lid)?.get(key);
    cb(currentValue);
  }

  unobserveLayerProp(
    lid: number,
    key: string,
    cb: (value: unknown) => void,
  ): void {
    this._layerPropObservers.get([lid, key])?.delete(cb);
  }

  // Internal

  _startBatchGeoChange(): void {
    this._batchGeoChange = 'unchanged';
  }

  _markGeoDidChange(): void {
    switch (this._batchGeoChange) {
      case 'unchanged':
        this._batchGeoChange = 'changed';
        break;
      case 'changed':
        break;
      case null:
        throw new Error(
          'markBatchGeoChange() called before startBatchGeoChange()',
        );
    }
  }

  _endBatchGeoChange(): void {
    if (this._batchGeoChange === 'changed') {
      for (const cb of this._geoObservers) {
        cb(this.geoRoot);
      }
    }
    this._batchGeoChange = null;
  }

  _callFeaturePropObservers(fid: number, key: string, value: unknown): void {
    const listeners = this._featurePropObservers.get([fid, key]);
    if (listeners) {
      for (const listener of listeners) {
        listener(value);
      }
    }
  }

  _callLayerPropObservers(lid: number, key: string, value: unknown): void {
    const listeners = this._layerPropObservers.get([lid, key]);
    if (listeners) {
      for (const listener of listeners) {
        listener(value);
      }
    }
  }

  _callLayerOrderObservers(): void {
    const order = this.layerOrder();
    for (const obs of this._layerOrderObservers) {
      obs(order);
    }
  }

  _callLayersObservers(f: (_: LayersObserver) => void): void {
    for (const obs of this._layersObservers) {
      f(obs);
    }
  }

  private _featureSet(fid: number, key: string, value: unknown): void {
    // Update props

    let props = this.features.get(fid);
    if (!props) {
      props = new Map<string, unknown>();
      this.features.set(fid, props);
    }
    props.set(key, value);

    // Update geo

    let geo = this._featureGeo.get(fid);
    if (!geo) {
      geo = {
        id: fid,
        type: 'Feature',
        geometry: null,
        properties: null,
      };
      this.geoRoot.features.push(geo);
    }

    if (key === 'geometry') {
      geo.geometry = value as GeoJSON.Geometry;
    } else {
      if (geo.properties == null) geo.properties = {};
      geo.properties[key] = value;
    }

    if (key !== 'geometry') {
      this._callFeaturePropObservers(fid, key, value);
    }
    this._markGeoDidChange();
  }

  private layerSet(lid: number, key: string, value: unknown): void {
    // Update props

    let props = this.layers.get(lid);
    if (!props) {
      props = new Map<string, unknown>();
      this.layers.set(lid, props);
    }
    props.set(key, value);

    if (key === 'idx') {
      const prevI = this._layerOrder.findIndex((l) => l.lid === lid);
      if (prevI !== -1) {
        this._layerOrder.splice(prevI, 1);
      }

      let after: number | undefined;
      if (value !== undefined) {
        this._layerOrder.push({ lid, idx: value as string });
        this._layerOrder.sort((a, b) => {
          if (a.idx < b.idx) return -1;
          if (a.idx > b.idx) return 1;
          return 0;
        });

        const newI = this._layerOrder.findIndex((l) => l.lid === lid);
        after = this._layerOrder[newI]?.lid;
      }

      this._callLayerOrderObservers();
      this._callLayersObservers((o) => {
        if (value === undefined) {
          o.removeLayer(lid);
        } else if (prevI === -1) {
          o.addLayer(this.layers.get(lid)!, after);
        } else {
          o.moveLayer(lid, after);
        }
      });
    } else {
      this._callLayerPropObservers(lid, key, value);
      this._callLayersObservers((o) => o.setProp(lid, key, value));
    }
  }
}

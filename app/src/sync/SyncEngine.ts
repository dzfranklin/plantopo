import { SyncChange } from './SyncChange';
import { SyncObserverManager } from './SyncObserverManager';
import { SyncOp } from './SyncOp';

type GeoRoot = GeoJSON.FeatureCollection<GeoJSON.Geometry | null>;

export class SyncEngine {
  features: Map<number, Map<string, unknown>> = new Map();
  layers: Map<number, Map<string, unknown>> = new Map();
  geoRoot: GeoRoot = {
    type: 'FeatureCollection',
    features: [],
  };

  om = new SyncObserverManager(this);

  private _layerOrder: Array<{ lid: number; idx: string }> = [];
  private featureGeo: Map<number, GeoJSON.Feature<GeoJSON.Geometry | null>> =
    new Map();

  layerOrder(): Array<number> {
    return this._layerOrder.map(({ lid }) => lid);
  }

  apply(op: SyncOp): void {
    this.om.startBatchGeoChange();
    switch (op.action) {
      case 'createFeature': {
        this.featureSet(op.id, 'pos', op.pos);
        this.featureSet(op.id, 'type', op.type);
        break;
      }
      case 'deleteFeature': {
        this.features.delete(op.id);
        break;
      }
      case 'featureSet': {
        this.featureSet(op.id, op.key, op.value);
      }
      case 'layerSet': {
        this.layerSet(op.id, op.key, op.value);
      }
    }
    this.om.endBatchGeoChange();
  }

  change(change: SyncChange): void {
    this.om.startBatchGeoChange();
    for (const [fid, k, v] of change.featureProps) {
      this.featureSet(fid, k, v);
    }
    for (const [lid, k, v] of change.layerProps) {
      this.layerSet(lid, k, v);
    }
    for (const fid of change.deletedFeatures) {
      this.features.delete(fid);
    }
    this.om.endBatchGeoChange();
  }

  private featureSet(fid: number, key: string, value: unknown): void {
    // Update props

    let props = this.features.get(fid);
    if (!props) {
      props = new Map<string, unknown>();
      this.features.set(fid, props);
    }
    props.set(key, value);

    // Update geo

    let geo = this.featureGeo.get(fid);
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
      this.om.callFeaturePropObservers(fid, key, value);
    }
    this.om.markGeoDidChange();
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

      this.om.callLayerOrderObservers();
      this.om.callLayersObservers((o) => {
        if (value === undefined) {
          o.removeLayer(lid);
        } else if (prevI === -1) {
          o.addLayer(this.layers.get(lid)!, after);
        } else {
          o.moveLayer(lid, after);
        }
      });
    } else {
      this.om.callLayerPropObservers(lid, key, value);
      this.om.callLayersObservers((o) => o.setProp(lid, key, value));
    }
  }
}

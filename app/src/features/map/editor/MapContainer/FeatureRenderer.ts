import { BBoxPolygon, CurrentCameraPosition } from '../CurrentCamera';
import { Scene, SceneFeature, SceneRootFeature } from '../engine/Scene';
import { bboxClip, booleanContains } from '@turf/turf';
import booleanIntersects from '@turf/boolean-intersects';
import { LineStringSyncGeometry, SyncGeometry } from '../api/sync_schema';

export interface RenderFeatureList {
  timing: {
    scene: Scene['timing'];
    start: number;
    end: number;
  };
  list: RenderFeature[];
}

export interface RenderFeature {
  id: string;
  children: RenderFeature[];

  selectedByMe: boolean;
  selectedByPeers: string[] | null;
  hoveredByMe: boolean;

  geometry: SyncGeometry;

  name: string | null;
  color: string;
}

interface Inherited {
  color: string;
}

const ROOT_INHERITED: Inherited = { color: '#000000' };

export class FeatureRenderer {
  // TODO: Write code to import a large gpx to test perf

  render(scene: Scene, camera: CurrentCameraPosition): RenderFeatureList {
    const start = performance.now();
    // TODO: Make a little bigger
    const clipBox = camera.bboxPolygon();

    const list: RenderFeature[] = [];
    this._render(clipBox, ROOT_INHERITED, scene.features.root, list);
    const end = performance.now();
    return { list, timing: { scene: scene.timing, start, end } };
  }

  private _render(
    clipBox: BBoxPolygon,
    inherited: Inherited,
    feature: SceneRootFeature | SceneFeature,
    out: RenderFeature[],
  ) {
    const [newInherited, itself] = this._renderItself(
      clipBox,
      inherited,
      feature,
    );

    if (itself) {
      out.push(itself);
    }

    for (const child of feature.children) {
      this._render(clipBox, newInherited ?? inherited, child, out);
    }
  }

  private _renderItself(
    clipBox: BBoxPolygon,
    inherited: Inherited,
    feature: SceneRootFeature | SceneFeature,
  ): [Inherited | null, RenderFeature | null] {
    if (!feature.parent) {
      // The root isn't rendered itself
      return [null, null];
    }

    let newInherited = null;
    if (feature.color) {
      newInherited = { ...inherited, color: feature.color };
    }

    if (!feature.geometry || feature.hidden) {
      return [newInherited, null];
    }

    let geometry: SyncGeometry;
    if (feature.geometry.type === 'Point') {
      if (!booleanContains(clipBox, feature.geometry)) {
        return [newInherited, null];
      }
      geometry = feature.geometry;
    } else if (feature.geometry.type === 'LineString') {
      if (!booleanIntersects(feature.geometry, clipBox)) {
        return [newInherited, null];
      }
      const clipped = bboxClip(feature.geometry, clipBox.bbox);
      geometry = clipped.geometry as LineStringSyncGeometry;
    } else {
      console.log('Unknown geometry type', feature.geometry['type']);
      return [newInherited, null];
    }

    const itself: RenderFeature = {
      ...feature,
      children: [],
      geometry,
      color: feature.color ?? inherited.color,
    };

    return [newInherited, itself];
  }
}

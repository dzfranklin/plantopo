import { BBoxPolygon } from '../CurrentCamera';
import { Scene, SceneFeature, SceneRootFeature } from '../engine/Scene';
import { booleanContains } from '@turf/turf';
import booleanIntersects from '@turf/boolean-intersects';
import { SyncGeometry } from '@/gen/sync_schema';
import { midpoint2 } from '@/generic/vector2';

export interface RenderList {
  timing: {
    scene: Scene['timing'];
    start: number;
    end: number;
  };
  list: RenderItem[];
}

export type RenderItem = RenderFeature | RenderFeatureHandle;

export interface RenderFeature {
  type: 'feature';
  id: string;
  children: RenderFeature[];

  active: boolean;
  selectedByMe: boolean;
  selectedByPeers: string[] | null;
  hoveredByMe: boolean;

  geometry: SyncGeometry;

  name: string | null;
  color: string;
}

export interface RenderFeatureHandle {
  type: 'handle';
  id: string; // id of the handle (not the id of the feature)
  feature: RenderFeature;
  handleType: 'vertex' | 'midpoint';
  geometry: {
    type: 'Point';
    coordinates: [number, number];
  };
}

interface Inherited {
  color: string;
}

const ROOT_INHERITED: Inherited = { color: '#000000' };

export class FeatureRenderer {
  render(scene: Scene, clipBox: BBoxPolygon): RenderList {
    const start = performance.now();

    const list: RenderFeature[] = [];
    this._render(clipBox, ROOT_INHERITED, scene.features.root, list);
    const end = performance.now();
    return { list, timing: { scene: scene.timing, start, end } };
  }

  private _render(
    clipBox: BBoxPolygon,
    inherited: Inherited,
    feature: SceneRootFeature | SceneFeature,
    out: RenderItem[],
  ) {
    const [newInherited, itself] = this._renderItself(
      clipBox,
      inherited,
      feature,
    );
    for (const item of itself) {
      out.push(item);
    }

    for (const child of feature.children) {
      this._render(clipBox, newInherited ?? inherited, child, out);
    }
  }

  private _renderItself(
    clipBox: BBoxPolygon,
    inherited: Inherited,
    feature: SceneRootFeature | SceneFeature,
  ): [Inherited | null, RenderItem[]] {
    if (!feature.parent) {
      // The root isn't rendered itself
      return [null, []];
    }

    let newInherited = null;
    if (feature.color) {
      newInherited = { ...inherited, color: feature.color };
    }

    if (!feature.geometry || feature.hidden) {
      return [newInherited, []];
    }

    let geometry: SyncGeometry;
    if (feature.geometry.type === 'Point') {
      if (!booleanContains(clipBox, feature.geometry)) {
        return [newInherited, []];
      }
      geometry = feature.geometry;
    } else if (feature.geometry.type === 'LineString') {
      if (!booleanIntersects(feature.geometry, clipBox)) {
        return [newInherited, []];
      }
      geometry = feature.geometry;
    } else {
      return [newInherited, []];
    }

    const itself: RenderItem[] = [];

    const rf: RenderFeature = {
      ...feature,
      type: 'feature',
      children: [],
      geometry,
      color: feature.color ?? inherited.color,
    };
    itself.push(rf);

    if (feature.geometry.type === 'LineString') {
      const coords = geometry.coordinates as [number, number][];
      for (const [i, coord] of coords.entries()) {
        itself.push({
          type: 'handle',
          feature: rf,
          id: `${feature.id}-handle${i}`,
          handleType: 'vertex',
          geometry: {
            type: 'Point',
            coordinates: coord,
          },
        });

        if (i < coords.length - 1) {
          const nextCoord = coords[i + 1]!;
          itself.push({
            type: 'handle',
            feature: rf,
            id: `${feature.id}-handle${i}-midpoint`,
            handleType: 'midpoint',
            geometry: {
              type: 'Point',
              coordinates: midpoint2(coord, nextCoord),
            },
          });
        }
      }
    }

    return [newInherited, itself];
  }
}

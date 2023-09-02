import { CurrentCameraPosition } from '../CurrentCamera';
import {
  Scene,
  SceneFeature,
  SceneRootFeature,
  nameForUnnamedFeature,
} from '../api/SyncEngine/Scene';
import * as GeoJSON from 'geojson';
import { bboxClip, bboxPolygon, booleanContains } from '@turf/turf';
import booleanIntersects from '@turf/boolean-intersects';

export interface RenderFeature {
  id: number;
  children: RenderFeature[];

  selectedByMe: boolean;
  selectedByPeers: string[] | null;
  hoveredByMe: boolean;

  geometry: GeoJSON.Point | GeoJSON.LineString;

  name: string;
  color: string;
}

interface Inherited {
  color: string;
}

const ROOT_INHERITED: Inherited = { color: '#000000' };

interface ClipBox extends GeoJSON.Feature<GeoJSON.Polygon> {
  bbox: GeoJSON.BBox;
}

export class FeatureRenderer {
  // TODO: Write code to import a large gpx to test perf

  render(scene: Scene, camera: CurrentCameraPosition): RenderFeature[] {
    // TODO: Make a little bigger
    const clipBox = bboxPolygon([
      camera.bbox.minX,
      camera.bbox.minY,
      camera.bbox.maxX,
      camera.bbox.maxY,
    ]) as ClipBox;

    const list: RenderFeature[] = [];
    this._render(clipBox, ROOT_INHERITED, scene.features.root, list);
    return list;
  }

  private _render(
    clipBox: ClipBox,
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
    clipBox: ClipBox,
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

    let geometry: GeoJSON.Point | GeoJSON.LineString;
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
      geometry = clipped.geometry as GeoJSON.LineString;
    } else {
      console.log('Unknown geometry type', feature.geometry.type);
      return [newInherited, null];
    }

    const itself: RenderFeature = {
      ...feature,
      children: [],
      geometry,
      name: feature.name || nameForUnnamedFeature(feature),
      color: feature.color ?? inherited.color,
    };

    return [newInherited, itself];
  }
}

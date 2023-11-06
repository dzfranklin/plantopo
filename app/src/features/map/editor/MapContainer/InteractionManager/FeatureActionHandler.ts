import { LineStringSyncGeometry, SyncGeometry } from '@/gen/sync_schema';
import { EditorEngine } from '../../engine/EditorEngine';
import { InteractionEvent, InteractionHandler } from './InteractionManager';
import { RenderFeatureHandle } from '../FeatureRenderer';

export class FeatureHoverHandler implements InteractionHandler {
  cursor?: string | undefined;

  onHover(evt: InteractionEvent, engine: EditorEngine): boolean {
    for (const hit of evt.queryHits()) {
      if (hit.minPixelsTo() < 0.5) {
        engine.setHovered(hit.item.id);
        this.cursor = 'pointer';
        return true;
      }
    }
    engine.setHovered(null);
    this.cursor = undefined;
    return false;
  }

  onPress(evt: InteractionEvent, engine: EditorEngine): boolean {
    const activeTool = engine.scene.activeTool;
    const activeFeature = engine.scene.activeFeature;
    if (
      activeTool === 'line' &&
      activeFeature?.geometry?.type === 'LineString'
    ) {
      const coordinates = [
        ...activeFeature.geometry.coordinates,
        evt.unproject(),
      ];
      engine.changeFeature({
        id: activeFeature.id,
        geometry: { type: 'LineString', coordinates },
      });
      return true;
    }

    for (const hit of evt.queryHits()) {
      if (hit.minPixelsTo() < 0.5) {
        engine.toggleSelection(hit.item.id, evt.shiftKey ? 'multi' : 'single');
        this.cursor = 'pointer';
        return true;
      }
    }
    this.cursor = undefined;
    return false;
  }

  private dragging: {
    fid: string;
  } | null = null;

  onDragStart(evt: InteractionEvent, engine: EditorEngine): boolean {
    for (const hit of evt.queryHits()) {
      if (hit.item.type !== 'handle' || hit.minPixelsTo() > 0.5) continue;
      const h = hit.item;
      const g = h.feature.geometry;
      engine.changeFeature({
        id: h.id,
        geometry: computeGeometryForHandleDrag(h, g, evt.unproject()),
      });
      this.dragging = {
        fid: h.id,
        type: h.type,
        geometryType: g.type,
      };
      this.cursor = 'grabbing';
      return true;
    }
    return false;
  }

  onDrag(
    evt: InteractionEvent,
    _delta: [number, number],
    engine: EditorEngine,
  ): boolean {
    if (this.dragging === null) return false;
    const g = engine.getFeature(this.dragging.fid)?.geometry;
    if (!g) return false;
    engine.changeFeature({
      id: this.dragging.fid,
      geometry: {
        type: 'Point',
        coordinates: computeGeometryForHandleDrag(
          this.dragging,
          g,
          evt.unproject(),
        ),
      },
    });
    return true;
  }

  onDragEnd(evt: InteractionEvent, engine: EditorEngine): boolean {
    if (this.dragging === null) return false;

    engine.changeFeature({
      id: this.dragging.fid,
      geometry: {
        type: 'Point',
        coordinates: evt.unproject(),
      },
    });

    this.dragging = null;
    this.cursor = undefined;
    return true;
  }
}

function computeGeometryForHandleDrag(
  h: Pick<RenderFeatureHandle, 'handleType' | 'i'>,
  g: SyncGeometry,
  pt: [number, number],
): SyncGeometry {
  switch (g.type) {
    case 'Point':
      return {
        type: 'Point',
        coordinates: pt,
      };
    case 'LineString':
      const coords = [...g.coordinates];
      switch (h.handleType) {
        case 'point':
          coords[h.i] = pt;
          break;
        case 'midpoint':
          coords.splice(h.i + 1, 0, pt);
          break;
      }
      return {
        type: 'LineString',
        coordinates: coords,
      };
  }
}

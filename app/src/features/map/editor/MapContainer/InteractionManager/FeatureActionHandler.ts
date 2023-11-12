import { SyncGeometry } from '@/gen/sync_schema';
import { EditorEngine } from '../../engine/EditorEngine';
import { InteractionEvent, InteractionHandler } from './InteractionManager';
import { RenderFeatureHandle } from '../FeatureRenderer';

type DragRef = Pick<RenderFeatureHandle, 'handleType' | 'i'> & {
  feature: {
    id: string;
  };
};

export class FeatureActionHandler implements InteractionHandler {
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

  private dragging: DragRef | null = null;

  onDragStart(evt: InteractionEvent, engine: EditorEngine): boolean {
    for (const hit of evt.queryHits()) {
      if (hit.item.type !== 'handle' || hit.minPixelsTo() > 0.5) continue;
      const h = hit.item;
      const g = h.feature.geometry;
      engine.changeFeature({
        id: h.feature.id,
        geometry: computeGeometryUpdate(h, g, evt.unproject()),
      });
      if (h.handleType === 'midpoint') {
        this.dragging = {
          handleType: 'point',
          feature: { id: h.feature.id },
          i: h.i + 1, // the vertex we just created
        };
      } else {
        this.dragging = h;
      }
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
    const g = engine.getFeature(this.dragging.feature.id)?.geometry;
    if (!g) return false;
    engine.changeFeature({
      id: this.dragging.feature.id,
      geometry: computeGeometryUpdate(this.dragging, g, evt.unproject()),
    });
    return true;
  }

  onDragEnd(evt: InteractionEvent, engine: EditorEngine): boolean {
    if (this.dragging === null) return false;
    const g = engine.getFeature(this.dragging.feature.id)?.geometry;
    if (!g) return false;
    engine.changeFeature({
      id: this.dragging.feature.id,
      geometry: computeGeometryUpdate(this.dragging, g, evt.unproject()),
    });

    this.dragging = null;
    this.cursor = undefined;
    return true;
  }
}

function computeGeometryUpdate(
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

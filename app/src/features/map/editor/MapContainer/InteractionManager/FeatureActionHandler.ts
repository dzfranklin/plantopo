import { EditorEngine } from '../../engine/EditorEngine';
import { InteractionEvent, InteractionHandler } from './InteractionManager';

export class FeatureHoverHandler implements InteractionHandler {
  cursor?: string | undefined;

  onHover(evt: InteractionEvent, engine: EditorEngine): boolean {
    for (const hit of evt.queryHits()) {
      if (hit.minPixelsTo() < 0.5) {
        engine.setHovered(hit.feature.id);
        this.cursor = 'pointer';
        return true;
      }
    }
    engine.setHovered(null);
    this.cursor = undefined;
    return false;
  }

  onPress(evt: InteractionEvent, engine: EditorEngine): boolean {
    for (const hit of evt.queryHits()) {
      if (hit.minPixelsTo() < 0.5) {
        engine.toggleSelection(hit.feature.id, 'single');
        this.cursor = 'pointer';
        return true;
      }
    }
    this.cursor = undefined;
    return false;
  }

  private dragging: string | null = null;

  onDragStart(evt: InteractionEvent, engine: EditorEngine): boolean {
    for (const hit of evt.queryHits()) {
      if (!hit.feature.selectedByMe) continue;
      if (hit.feature.geometry?.type === 'Point' && hit.minPixelsTo() < 0.5) {
        this.dragging = hit.feature.id;

        engine.changeFeature({
          id: hit.feature.id,
          geometry: {
            type: 'Point',
            coordinates: evt.unproject(),
          },
        });

        this.cursor = 'grabbing';
        return true;
      }
    }
    return false;
  }

  onDrag(
    evt: InteractionEvent,
    _delta: [number, number],
    engine: EditorEngine,
  ): boolean {
    if (this.dragging === null) return false;
    engine.changeFeature({
      id: this.dragging,
      geometry: {
        type: 'Point',
        coordinates: evt.unproject(),
      },
    });
    return true;
  }

  onDragEnd(evt: InteractionEvent, engine: EditorEngine): boolean {
    if (this.dragging === null) return false;

    engine.changeFeature({
      id: this.dragging,
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

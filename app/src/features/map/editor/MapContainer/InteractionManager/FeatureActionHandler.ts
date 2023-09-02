import { SyncEngine } from '../../api/SyncEngine';
import { InteractionEvent, InteractionHandler } from './InteractionManager';

export class FeatureHoverHandler implements InteractionHandler {
  cursor?: string | undefined;

  onHover(evt: InteractionEvent, engine: SyncEngine): boolean {
    for (const hit of evt.queryHits()) {
      if (hit.minPixelsTo() < 0.5) {
        engine.fSetHovered(hit.feature.id);
        this.cursor = 'pointer';
        return true;
      }
    }
    engine.fSetHovered(null);
    this.cursor = undefined;
    return false;
  }

  onPress(evt: InteractionEvent, engine: SyncEngine): boolean {
    for (const hit of evt.queryHits()) {
      if (hit.minPixelsTo() < 0.5) {
        engine.fReplaceMySelection(hit.feature.id);
        this.cursor = 'pointer';
        return true;
      }
    }
    this.cursor = undefined;
    return false;
  }

  private dragging: number | null = null;

  onDragStart(evt: InteractionEvent, engine: SyncEngine): boolean {
    for (const hit of evt.queryHits()) {
      if (!hit.feature.selectedByMe) continue;
      if (hit.feature.geometry?.type === 'Point' && hit.minPixelsTo() < 0.5) {
        this.dragging = hit.feature.id;

        engine.fSetGeometry(hit.feature.id, {
          type: 'Point',
          coordinates: evt.unproject(),
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
    engine: SyncEngine,
  ): boolean {
    if (this.dragging === null) return false;
    engine.fSetGeometry(this.dragging, {
      type: 'Point',
      coordinates: evt.unproject(),
    });
    return true;
  }

  onDragEnd(evt: InteractionEvent, engine: SyncEngine): boolean {
    if (this.dragging === null) return false;

    engine.fSetGeometry(this.dragging, {
      type: 'Point',
      coordinates: evt.unproject(),
    });

    this.dragging = null;
    this.cursor = undefined;
    return true;
  }
}

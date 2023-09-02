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
}

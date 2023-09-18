import { EditorEngine } from '../../engine/EditorEngine';
import { InteractionEvent, InteractionHandler } from './InteractionManager';

export class CreateFeatureHandler implements InteractionHandler {
  cursor = 'crosshair';

  onPress(evt: InteractionEvent, engine: EditorEngine): boolean {
    const fid = engine.createFeature({
      geometry: {
        type: 'Point',
        coordinates: evt.unproject(),
      },
    });
    engine.toggleSelection(fid, 'single');
    return true;
  }
}
